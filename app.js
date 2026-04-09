// ================================================================
// app.js — Mortgage Repayment Calculator
//
// 구조 개요:
//   [1] DOM 초기화     — querySelector 호출을 한 곳에 집약
//   [2] 비즈니스 로직  — DOM에 의존하지 않는 순수 계산 함수
//   [3] UI 유틸리티   — 에러 스타일 토글 · 통화 포맷팅
//   [4] 유효성 검사    — 에러 판단 후 [3]을 호출
//   [5] 화면 업데이트  — 계산 결과를 DOM에 반영
//   [6] 이벤트 바인딩  — 모든 사용자 인터랙션 등록
//   [7] 앱 초기화      — DOMContentLoaded 시 [1] → [6] 실행
// ================================================================


// ================================================================
// [1] DOM 초기화
// ================================================================

/**
 * 앱 전체에서 사용할 DOM 요소를 한 곳에서 수집해 객체로 반환합니다.
 * querySelector 호출을 분산하지 않고 여기에 집약시켜,
 * HTML id가 변경될 때 수정 지점을 단 한 곳으로 제한합니다.
 *
 * @returns {{ form, clearAllBtn, emptyState, resultsState, monthlyEl, totalEl,
 *             inputs: {amount, term, rate},
 *             wrappers: {amount, term, rate},
 *             errors: {amount, term, rate, type} }}
 */
function initElements() {
  return {
    form:         document.getElementById("mortgageForm"),
    clearAllBtn:  document.getElementById("clearAllBtn"),
    emptyState:   document.getElementById("emptyState"),
    resultsState: document.getElementById("resultsState"),
    monthlyEl:    document.getElementById("monthlyRepayment"),
    totalEl:      document.getElementById("totalRepayment"),
    inputs: {
      amount: document.getElementById("mortgageAmount"),
      term:   document.getElementById("mortgageTerm"),
      rate:   document.getElementById("interestRate"),
    },
    wrappers: {
      amount: document.getElementById("amountWrapper"),
      term:   document.getElementById("termWrapper"),
      rate:   document.getElementById("rateWrapper"),
    },
    errors: {
      amount: document.getElementById("amountError"),
      term:   document.getElementById("termError"),
      rate:   document.getElementById("rateError"),
      type:   document.getElementById("typeError"),
    },
  };
}


// ================================================================
// [2] 비즈니스 로직 (Pure Functions)
//     DOM·UI에 의존하지 않으므로 단독 테스트와 재사용이 가능합니다.
// ================================================================

/**
 * 원리금 균등상환(Repayment) 방식의 월 납입액을 계산합니다.
 *
 * 공식: M = P × [r(1+r)^n] / [(1+r)^n - 1]
 *   - P: 원금
 *   - r: 월 이자율 (연 이자율 ÷ 12 ÷ 100)
 *   - n: 총 납입 횟수 (기간 × 12)
 *   - factor = (1+r)^n : 이자 복리 성장 배수. 이 값이 분자·분모를 결정합니다.
 *
 * @param {number} principal     - 원금
 * @param {number} monthlyRate   - 월 이자율 (소수, 예: 연 5.25% → 0.004375)
 * @param {number} totalPayments - 총 납입 횟수
 * @returns {number} 월 납입액
 */
function calcRepayment(principal, monthlyRate, totalPayments) {
  // 이자율 0%이면 factor 계산에서 분모가 0이 돼 NaN이 발생하므로 별도 처리합니다.
  if (monthlyRate === 0) return principal / totalPayments;

  const factor = Math.pow(1 + monthlyRate, totalPayments); // 복리 성장 배수
  return principal * (monthlyRate * factor) / (factor - 1);
}

/**
 * 이자만 상환(Interest Only) 방식의 월 납입액을 계산합니다.
 * 원금은 그대로 두고 이자만 납부하므로, 매달 납입액이 일정합니다.
 * 원금 상환은 대출 만기 시 일시 상환하는 별도 계약으로 처리됩니다.
 *
 * @param {number} principal   - 원금
 * @param {number} monthlyRate - 월 이자율 (소수)
 * @returns {number} 월 납입액
 */
function calcInterestOnly(principal, monthlyRate) {
  return principal * monthlyRate;
}

/**
 * 상환 유형에 따라 적절한 계산 함수로 위임하고,
 * 월 납입액(monthly)과 총 납입액(total)을 반환합니다.
 *
 * @param {number} amount - 모기지 원금
 * @param {number} term   - 상환 기간 (년)
 * @param {number} rate   - 연 이자율 (%)
 * @param {string} type   - "repayment" | "interest-only"
 * @returns {{ monthly: number, total: number }}
 */
function calculateMortgage(amount, term, rate, type) {
  const monthlyRate   = rate / 100 / 12; // 연 이자율(%) → 월 이자율(소수)
  const totalPayments = term * 12;

  const monthly = type === "repayment"
    ? calcRepayment(amount, monthlyRate, totalPayments)
    : calcInterestOnly(amount, monthlyRate);

  return { monthly, total: monthly * totalPayments };
}


// ================================================================
// [3] UI 유틸리티
// ================================================================

/**
 * 숫자를 파운드 통화 문자열로 변환합니다. (예: 1797.74 → "£1,797.74")
 * en-GB 로케일을 명시해 천 단위 구분자와 소수점 기호가
 * 사용자의 브라우저 언어 설정에 관계없이 항상 동일하게 출력되도록 합니다.
 *
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  return "£" + value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 입력 래퍼에 에러 스타일을 적용하고 오류 메시지를 노출합니다.
 * 테두리뿐 아니라 badge(£ / years / %)의 배경색도 함께 바꾸어
 * 에러 상태임을 색상으로 통일감 있게 전달합니다.
 *
 * @param {HTMLElement} wrapper  - 입력창과 badge를 감싸는 div
 * @param {HTMLElement} errorEl  - 오류 메시지 p 태그
 */
function showError(wrapper, errorEl) {
  wrapper.classList.remove("border-slate-300", "focus-within:border-lime", "focus-within:ring-lime");
  wrapper.classList.add("border-err-red", "ring-1", "ring-err-red");

  wrapper.querySelectorAll(".badge-left, .badge-right").forEach(badge => {
    badge.classList.remove("bg-slate-100", "text-slate-700");
    badge.classList.add("bg-err-red", "text-white");
  });

  errorEl.classList.remove("hidden");
}

/**
 * showError()의 역연산. 에러 스타일을 제거하고 오류 메시지를 숨깁니다.
 * 사용자가 입력을 시작하는 즉시 호출해 불필요한 에러 표시를 제거합니다.
 *
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} errorEl
 */
function clearError(wrapper, errorEl) {
  wrapper.classList.remove("border-err-red", "ring-1", "ring-err-red");
  wrapper.classList.add("border-slate-300", "focus-within:border-lime", "focus-within:ring-lime");

  wrapper.querySelectorAll(".badge-left, .badge-right").forEach(badge => {
    badge.classList.remove("bg-err-red", "text-white");
    badge.classList.add("bg-slate-100", "text-slate-700");
  });

  errorEl.classList.add("hidden");
}


// ================================================================
// [4] 유효성 검사
// ================================================================

/**
 * 폼 입력값을 검사하고, 통과하면 파싱된 값을 반환합니다.
 *
 * fieldChecks 배열 패턴을 사용해 각 필드의 조건·래퍼·에러 요소를 묶어 처리합니다.
 * if-else 체인 대신 배열을 순회하므로, 필드를 추가·제거할 때 조건 하나만 수정하면 됩니다.
 * 모든 필드를 순회한 후에 hasError를 평가하기 때문에, 하나가 실패해도
 * 나머지 필드의 에러 상태도 빠짐없이 갱신됩니다.
 *
 * @param {object} inputs   - { amount, term, rate } 입력 요소
 * @param {object} wrappers - { amount, term, rate } 래퍼 요소
 * @param {object} errors   - { amount, term, rate, type } 에러 메시지 요소
 * @returns {{ valid: false } | { valid: true, amount: number, term: number, rate: number, type: string }}
 */
function validateForm(inputs, wrappers, errors) {
  // 금액 필드는 type="text"이므로 콤마를 제거한 뒤 숫자로 변환합니다.
  const amountRaw    = inputs.amount.value.replace(/,/g, "");
  const amount       = parseFloat(amountRaw);
  const term         = parseInt(inputs.term.value, 10);
  const rate         = parseFloat(inputs.rate.value);
  const selectedType = document.querySelector('input[name="mortgageType"]:checked');

  const fieldChecks = [
    { fail: !amountRaw || isNaN(amount) || amount <= 0,                    wrapper: wrappers.amount, error: errors.amount },
    { fail: !inputs.term.value || isNaN(term) || term < 1 || term > 40,   wrapper: wrappers.term,   error: errors.term   },
    { fail: !inputs.rate.value || isNaN(rate) || rate < 0,                 wrapper: wrappers.rate,   error: errors.rate   },
  ];

  let hasError = false;

  fieldChecks.forEach(({ fail, wrapper, error }) => {
    if (fail) { showError(wrapper, error); hasError = true; }
    else      { clearError(wrapper, error); }
  });

  // 라디오 버튼은 wrapper가 없으므로 별도로 처리합니다.
  if (!selectedType) {
    errors.type.classList.remove("hidden");
    hasError = true;
  } else {
    errors.type.classList.add("hidden");
  }

  if (hasError) return { valid: false };
  return { valid: true, amount, term, rate, type: selectedType.value };
}


// ================================================================
// [5] 화면 업데이트
// ================================================================

/**
 * 계산 결과를 DOM에 반영하고 Empty ↔ Results 상태를 전환합니다.
 * hidden 클래스 토글만으로 상태를 전환해 레이아웃 재계산(reflow) 비용을 최소화합니다.
 *
 * @param {{ monthly: number, total: number }} result
 * @param {HTMLElement} monthlyEl
 * @param {HTMLElement} totalEl
 * @param {HTMLElement} emptyState
 * @param {HTMLElement} resultsState
 */
function updateUI(result, monthlyEl, totalEl, emptyState, resultsState) {
  monthlyEl.textContent = formatCurrency(result.monthly);
  totalEl.textContent   = formatCurrency(result.total);
  emptyState.classList.add("hidden");
  resultsState.classList.remove("hidden");
}


// ================================================================
// [6] 이벤트 바인딩
// ================================================================

/**
 * 모든 사용자 인터랙션 이벤트를 등록합니다.
 * 이벤트 리스너는 initElements()가 반환한 el 객체를 통해서만 DOM에 접근합니다.
 *
 * @param {ReturnType<typeof initElements>} el
 */
function bindEvents(el) {
  const { form, clearAllBtn, emptyState, resultsState, monthlyEl, totalEl, inputs, wrappers, errors } = el;

  // ── 폼 제출: 검사 → 계산 → 화면 반영 ──────────────────────────
  form.addEventListener("submit", (e) => {
    e.preventDefault(); // 브라우저 기본 제출(페이지 이동)을 막습니다.
    const validated = validateForm(inputs, wrappers, errors);
    if (!validated.valid) return;

    const result = calculateMortgage(validated.amount, validated.term, validated.rate, validated.type);
    updateUI(result, monthlyEl, totalEl, emptyState, resultsState);
  });

  // ── Clear All: 폼·에러·라디오 점·결과 화면을 초기 상태로 되돌립니다 ──
  clearAllBtn.addEventListener("click", () => {
    form.reset(); // 브라우저 내장 reset은 입력값만 초기화합니다.
                  // Tailwind 에러 클래스는 JS가 직접 제거해야 합니다.
    clearError(wrappers.amount, errors.amount);
    clearError(wrappers.term,   errors.term);
    clearError(wrappers.rate,   errors.rate);
    errors.type.classList.add("hidden");

    document.querySelectorAll('input[name="mortgageType"]').forEach(r => {
      const dot = r.nextElementSibling.querySelector("span");
      if (dot) dot.classList.add("hidden");
    });

    resultsState.classList.add("hidden");
    emptyState.classList.remove("hidden");
  });

  // ── 금액 입력: 실시간 천 단위 콤마 포맷팅 ───────────────────────
  inputs.amount.addEventListener("input", (e) => {
    clearError(wrappers.amount, errors.amount);

    // /[^0-9.]/g — 숫자와 소수점 외 모든 문자(기존 콤마 포함)를 제거합니다.
    // 소수점(.)을 허용하는 이유: 금액에 페니(소수점 이하 단위)가 포함될 수 있기 때문입니다.
    let value = e.target.value.replace(/[^0-9.]/g, "");
    if (value !== "") {
      const parts = value.split(".");
      // /\B(?=(\d{3})+(?!\d))/g — 정수 부분에 천 단위 콤마를 삽입하는 lookahead 정규식입니다.
      // \B: 단어 경계가 아닌 위치 / (?=(\d{3})+(?!\d)): 뒤에 숫자가 3의 배수 개 남은 위치
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      e.target.value = parts.join(".");
    }
  });

  // ── 기간·이자율 입력: 타이핑 시작 즉시 에러 해제 ────────────────
  inputs.term.addEventListener("input", () => clearError(wrappers.term, errors.term));
  inputs.rate.addEventListener("input", () => clearError(wrappers.rate, errors.rate));

  // ── 라디오 버튼: 유형 에러 해제 + 커스텀 내부 점(dot) 제어 ──────
  //
  // NOTE: CSS 한계 보완
  // HTML에서 peer-checked는 직계 형제(sibling)에만 작용합니다.
  // 내부 dot span은 radio의 조카(nephew) 위치에 있어 CSS만으로 제어할 수 없습니다.
  // 따라서 change 이벤트에서 전체 초기화 후 선택된 항목만 dot을 표시합니다.
  //
  // NOTE: 화살표 함수 대신 function 키워드를 사용하는 이유
  // this가 이벤트를 발생시킨 radio 요소를 가리켜야 하기 때문입니다.
  // 화살표 함수는 this를 상위 스코프에서 상속하므로 여기서는 사용할 수 없습니다.
  document.querySelectorAll('input[name="mortgageType"]').forEach(radio => {
    radio.addEventListener("change", function () {
      errors.type.classList.add("hidden");

      document.querySelectorAll('input[name="mortgageType"]').forEach(r => {
        const dot = r.nextElementSibling.querySelector("span");
        if (dot) dot.classList.add("hidden");
      });
      const selectedDot = this.nextElementSibling.querySelector("span");
      if (selectedDot) selectedDot.classList.remove("hidden");
    });
  });
}


// ================================================================
// [7] 앱 초기화
// ================================================================

// DOMContentLoaded 이후에 실행되므로 app.js에 defer가 있어도 안전하게 동작합니다.
// DOM 참조를 initElements()에서 한 번에 확보한 뒤 bindEvents()에 전달합니다.
document.addEventListener("DOMContentLoaded", () => {
  const el = initElements();
  bindEvents(el);
});
