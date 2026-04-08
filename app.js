// =====================================================
// app.js — 모기지 상환 계산기 동작 로직
// HTML이 모두 로드된 뒤에 실행되도록 DOMContentLoaded 이벤트로 감쌉니다.
// (DOMContentLoaded: 브라우저가 HTML을 다 읽은 직후 발생하는 신호입니다)
// =====================================================
document.addEventListener("DOMContentLoaded", function () {

  // ─────────────────────────────────────────
  // 1. HTML 요소들을 변수에 저장합니다
  //    (나중에 쉽게 꺼내 쓰기 위해 미리 담아둡니다)
  // ─────────────────────────────────────────

  const form        = document.getElementById("mortgageForm");     // 폼 전체
  const clearAllBtn = document.getElementById("clearAllBtn");      // Clear All 버튼
  const emptyState  = document.getElementById("emptyState");       // 대기 화면 (일러스트)
  const resultsState = document.getElementById("resultsState");    // 결과 화면 (금액 카드)
  const monthlyEl   = document.getElementById("monthlyRepayment"); // 월 상환액 표시 요소
  const totalEl     = document.getElementById("totalRepayment");   // 총 상환액 표시 요소

  // 입력 요소들
  const amountInput = document.getElementById("mortgageAmount");   // 모기지 금액 입력창
  const termInput   = document.getElementById("mortgageTerm");     // 모기지 기간 입력창
  const rateInput   = document.getElementById("interestRate");     // 이자율 입력창

  // 입력 래퍼(테두리를 감싸는 div)들
  const amountWrapper = document.getElementById("amountWrapper");  // 금액 입력 래퍼
  const termWrapper   = document.getElementById("termWrapper");    // 기간 입력 래퍼
  const rateWrapper   = document.getElementById("rateWrapper");    // 이자율 입력 래퍼

  // 오류 메시지 요소들
  const amountError = document.getElementById("amountError");      // 금액 오류 메시지
  const termError   = document.getElementById("termError");        // 기간 오류 메시지
  const rateError   = document.getElementById("rateError");        // 이자율 오류 메시지
  const typeError   = document.getElementById("typeError");        // 유형 오류 메시지


  // ─────────────────────────────────────────
  // 2. 유틸리티 함수들 (도우미 함수)
  // ─────────────────────────────────────────

  /**
   * 숫자를 천 단위 쉼표가 찍힌 파운드 통화 형식으로 변환합니다.
   * 예: 1797.74 → "£1,797.74"
   * @param {number} value - 변환할 숫자
   * @returns {string} - 포맷된 문자열
   */
  function formatCurrency(value) {
    // toLocaleString: 숫자를 지역 형식에 맞게 변환해주는 내장 함수입니다
    return "£" + value.toLocaleString("en-GB", {
      minimumFractionDigits: 2, // 소수점 최소 2자리 (예: .70이 .7로 줄어들지 않게)
      maximumFractionDigits: 2, // 소수점 최대 2자리
    });
  }

  /**
   * 입력 래퍼에 에러 스타일(빨간 테두리)을 적용하고 오류 메시지를 보여줍니다.
   * @param {HTMLElement} wrapper  - 테두리를 감싸는 div 요소
   * @param {HTMLElement} errorEl - 오류 메시지 p 태그
   */
  function showError(wrapper, errorEl) {
    // 기존 회색 테두리 클래스를 제거하고 빨간 테두리 클래스를 추가합니다
    wrapper.classList.remove("border-slate-300", "focus-within:border-lime", "focus-within:ring-lime");
    wrapper.classList.add("border-err-red", "ring-1", "ring-err-red");

    // 뱃지(£, years, %)의 배경색도 빨간색으로 바꿉니다
    const badges = wrapper.querySelectorAll(".badge-left, .badge-right");
    badges.forEach(function (badge) {
      badge.classList.remove("bg-slate-100", "text-slate-700");
      badge.classList.add("bg-err-red", "text-white");
    });

    // 오류 메시지를 숨김 상태에서 보이게 만듭니다
    errorEl.classList.remove("hidden");
  }

  /**
   * 입력 래퍼의 에러 스타일을 제거하고 오류 메시지를 숨깁니다.
   * @param {HTMLElement} wrapper  - 테두리를 감싸는 div 요소
   * @param {HTMLElement} errorEl - 오류 메시지 p 태그
   */
  function clearError(wrapper, errorEl) {
    // 빨간 테두리 클래스를 제거하고 원래 회색 테두리로 되돌립니다
    wrapper.classList.remove("border-err-red", "ring-1", "ring-err-red");
    wrapper.classList.add("border-slate-300", "focus-within:border-lime", "focus-within:ring-lime");

    // 뱃지 색상도 원래 슬레이트 색으로 되돌립니다
    const badges = wrapper.querySelectorAll(".badge-left, .badge-right");
    badges.forEach(function (badge) {
      badge.classList.remove("bg-err-red", "text-white");
      badge.classList.add("bg-slate-100", "text-slate-700");
    });

    // 오류 메시지를 다시 숨깁니다
    errorEl.classList.add("hidden");
  }


  // ─────────────────────────────────────────
  // 3. 폼 제출(Calculate Repayments 클릭) 이벤트
  // ─────────────────────────────────────────

  form.addEventListener("submit", function (e) {
    // e.preventDefault(): 폼 제출 시 페이지가 새로고침되는 기본 동작을 막습니다
    e.preventDefault();

    // 입력값을 읽어옵니다 (금액은 콤마를 제거하고 숫자로 바꿉니다)
    /* replace(/,/g, ""): 글자 사이사이에 있는 모든 콤마(,)를 지워서 순수한 숫자로 만듭니다 */
    const amount = parseFloat(amountInput.value.replace(/,/g, "")); 
    const term   = parseInt(termInput.value, 10); // 문자열 → 정수로 변환 (10진법)
    const rate   = parseFloat(rateInput.value);   // 문자열 → 소수점 숫자로 변환

    // 선택된 라디오 버튼의 값을 가져옵니다
    const selectedType = document.querySelector('input[name="mortgageType"]:checked');

    // ── 유효성 검사: 빈칸이나 잘못된 값이 있으면 에러를 표시합니다 ──
    let hasError = false; // 에러가 하나라도 있는지 추적하는 변수

    // 금액 검사: 콤마를 뺀 순수 값이 비어있거나 0 이하면 에러
    const amountRaw = amountInput.value.replace(/,/g, "");
    if (!amountRaw || isNaN(amount) || amount <= 0) {
      showError(amountWrapper, amountError);
      hasError = true;
    } else {
      clearError(amountWrapper, amountError);
    }

    // 기간 검사: 비어있거나 1년 미만이거나 40년 초과면 에러
    if (!termInput.value || isNaN(term) || term < 1 || term > 40) {
      showError(termWrapper, termError);
      hasError = true;
    } else {
      clearError(termWrapper, termError);
    }

    // 이자율 검사: 비어있거나 0 미만이면 에러
    if (!rateInput.value || isNaN(rate) || rate < 0) {
      showError(rateWrapper, rateError);
      hasError = true;
    } else {
      clearError(rateWrapper, rateError);
    }

    // 모기지 유형 검사: 라디오 버튼이 선택되지 않으면 에러
    if (!selectedType) {
      typeError.classList.remove("hidden"); // 오류 메시지를 보여줍니다
      hasError = true;
    } else {
      typeError.classList.add("hidden");    // 오류 메시지를 숨깁니다
    }

    // 에러가 하나라도 있으면 계산을 중단합니다
    if (hasError) return;

    // ── 계산 로직 ──

    // 월 이자율: 연 이자율을 12로 나눠서 월 단위로 변환합니다
    // 예: 연 5.25% → 월 0.4375% → 소수로는 0.004375
    const monthlyRate  = rate / 100 / 12;

    // 총 납입 횟수: 기간(년) × 12개월
    const totalPayments = term * 12;

    let monthly = 0; // 월 납입액을 담을 변수
    let total   = 0; // 총 납입액을 담을 변수

    if (selectedType.value === "repayment") {
      // ── 원리금 균등상환 방식 ──
      // 공식: M = P × [r(1+r)^n] / [(1+r)^n - 1]
      // P = 원금, r = 월 이자율, n = 총 납입 횟수

      if (monthlyRate === 0) {
        // 이자율이 0%인 특수한 경우: 단순히 원금 ÷ 납입 횟수
        monthly = amount / totalPayments;
      } else {
        // Math.pow(밑, 지수): 거듭제곱 계산 함수입니다
        // 예: Math.pow(1.004375, 300) = 1.004375의 300제곱
        const factor = Math.pow(1 + monthlyRate, totalPayments);
        monthly = amount * (monthlyRate * factor) / (factor - 1);
      }

      // 총 납입액: 월 납입액 × 총 납입 횟수
      total = monthly * totalPayments;

    } else {
      // ── 이자만 상환 방식 ──
      // 매달 이자만 내는 방식: 원금 × 월 이자율
      monthly = amount * monthlyRate;

      // 총 납입액: 월 이자 × 납입 횟수 (원금은 별도로 만기에 상환)
      total = monthly * totalPayments;
    }

    // ── 화면에 결과를 표시합니다 ──

    // 계산된 금액을 쉼표 포맷으로 변환해서 화면에 넣습니다
    monthlyEl.textContent = formatCurrency(monthly);
    totalEl.textContent   = formatCurrency(total);

    // 대기 화면(일러스트)을 숨기고 결과 화면을 보여줍니다 (DOM 토글)
    emptyState.classList.add("hidden");
    resultsState.classList.remove("hidden");
  });


  // ─────────────────────────────────────────
  // 4. Clear All 버튼: 모든 입력값과 결과를 초기화합니다
  // ─────────────────────────────────────────

  clearAllBtn.addEventListener("click", function () {
    // 폼의 모든 입력값을 한 번에 비워줍니다
    form.reset();

    // 모든 에러 표시를 제거합니다
    clearError(amountWrapper, amountError);
    clearError(termWrapper,   termError);
    clearError(rateWrapper,   rateError);
    typeError.classList.add("hidden");

    // 라디오 버튼 커스텀 내부 원을 모두 숨깁니다
    document.querySelectorAll('input[name="mortgageType"]').forEach(function (r) {
      const dot = r.nextElementSibling.querySelector("span");
      if (dot) dot.classList.add("hidden");
    });

    // 결과 화면을 숨기고 대기 화면(일러스트)을 다시 보여줍니다
    resultsState.classList.add("hidden");
    emptyState.classList.remove("hidden");
  });


  // ─────────────────────────────────────────
  // 5. 실시간 에러 제거: 사용자가 입력을 시작하면 에러를 바로 없애줍니다
  //    (입력 중에도 빨간 테두리가 계속 보이면 불편하기 때문입니다)
  // ─────────────────────────────────────────

  // 실시간 콤마 포맷팅: 숫자를 입력할 때마다 천 단위 쉼표를 찍어줍니다
  amountInput.addEventListener("input", function (e) {
    // 1. 에러 스타일이 있다면 먼저 지워줍니다
    clearError(amountWrapper, amountError);

    // 2. 현재 입력된 값에서 숫자 이외의 문자(콤마 등)를 모두 제거합니다
    let value = e.target.value.replace(/[^0-9.]/g, "");
    
    // 3. 값이 비어있지 않다면 포맷팅을 진행합니다
    if (value !== "") {
      const parts = value.split(".");
      // 정수 부분에만 콤마를 찍습니다
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      // 소수점이 있다면 다시 합쳐줍니다
      e.target.value = parts.join(".");
    }
  });

  termInput.addEventListener("input",   function () { clearError(termWrapper,   termError);   });
  rateInput.addEventListener("input",   function () { clearError(rateWrapper,   rateError);   });

  // 라디오 버튼을 선택하면 유형 에러를 없애줍니다
  document.querySelectorAll('input[name="mortgageType"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      typeError.classList.add("hidden");
    });
  });


  // ─────────────────────────────────────────
  // 6. 라디오 버튼 커스텀 스타일: 선택 시 내부 채운 원을 표시합니다
  //    (CSS의 peer-checked만으로 형제 span 안의 자식 span을 제어하는 데 한계가 있어 JS로 보완합니다)
  // ─────────────────────────────────────────

  document.querySelectorAll('input[name="mortgageType"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      // 모든 라디오의 내부 원(채운 원)을 먼저 전부 숨깁니다
      document.querySelectorAll('input[name="mortgageType"]').forEach(function (r) {
        const dot = r.nextElementSibling.querySelector("span"); // 내부 채운 원 요소
        if (dot) dot.classList.add("hidden");                   // 숨깁니다
      });

      // 현재 선택된 라디오의 내부 원만 다시 보여줍니다
      const selectedDot = this.nextElementSibling.querySelector("span");
      if (selectedDot) selectedDot.classList.remove("hidden");
    });
  });

}); // DOMContentLoaded 이벤트 종료
