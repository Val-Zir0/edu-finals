let currentChapter = 1;
let currentQuestionIndex = 0;
let scoreCorrect = 0;
let scoreWrong = 0;
let currentQuestions = [];
let answerSelected = false;

// Elements
const overlay = document.getElementById('quiz-overlay');
const confirmModal = document.getElementById('quiz-confirm-modal');
const qBox = document.getElementById('quiz-q-box');
const resultBox = document.getElementById('quiz-result-screen');
const nextBtn = document.getElementById('quiz-btn-next');
const titleEl = document.getElementById('quiz-title');

const qText = document.getElementById('quiz-q-text');
const optionsContainer = document.getElementById('quiz-options');
const feedbackEl = document.getElementById('quiz-feedback');
const badgeNum = document.getElementById('quiz-badge-num');

const barFill = document.getElementById('quiz-bar-fill');
const progressText = document.getElementById('quiz-progress-text');

const scoreCardC = document.getElementById('quiz-score-c');
const scoreCardW = document.getElementById('quiz-score-w');
const scoreCardT = document.getElementById('quiz-score-t');

const letters = ['أ', 'ب', 'ج', 'د'];

function openQuiz(chapter) {
  if (!chapterQuizzes[chapter] || chapterQuizzes[chapter].length === 0) {
    alert("لا توجد أسئلة لهذا الفصل حالياً.");
    return;
  }
  currentChapter = chapter;
  currentQuestions = [...chapterQuizzes[chapter]]; // Copy array
  
  // Reset states
  currentQuestionIndex = 0;
  scoreCorrect = 0;
  scoreWrong = 0;
  
  titleEl.innerText = `اختبار الفصل ${chapter}`;
  scoreCardT.innerText = currentQuestions.length;
  
  qBox.style.display = 'block';
  resultBox.style.display = 'none';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  loadQuestion();
}

function closeQuizWarning() {
  confirmModal.classList.add('active');
}

function closeQuizForce() {
  confirmModal.classList.remove('active');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function cancelClose() {
  confirmModal.classList.remove('active');
}

function loadQuestion() {
  answerSelected = false;
  nextBtn.style.display = 'none';
  feedbackEl.style.display = 'none';
  feedbackEl.className = 'quiz-feedback';
  
  scoreCardC.innerText = scoreCorrect;
  scoreCardW.innerText = scoreWrong;
  
  let q = currentQuestions[currentQuestionIndex];
  badgeNum.innerText = currentQuestionIndex + 1;
  progressText.innerText = `سؤال ${currentQuestionIndex + 1} من ${currentQuestions.length}`;
  barFill.style.width = `${((currentQuestionIndex) / currentQuestions.length) * 100}%`;
  
  qText.innerText = q.question;
  optionsContainer.innerHTML = '';
  
  q.options.forEach((optText, i) => {
    let div = document.createElement('div');
    div.className = 'quiz-opt';
    div.innerHTML = `<div class="quiz-opt-letter">${letters[i]}</div><span>${optText}</span>`;
    div.onclick = () => selectOption(i, div);
    optionsContainer.appendChild(div);
  });
}

function selectOption(index, optDiv) {
  if (answerSelected) return;
  answerSelected = true;
  
  let q = currentQuestions[currentQuestionIndex];
  let isCorrect = (index === q.correct);
  
  let allOpts = optionsContainer.querySelectorAll('.quiz-opt');
  allOpts.forEach(o => o.classList.add('disabled'));
  
  optDiv.classList.add('selected');
  
  if (isCorrect) {
    optDiv.classList.add('correct');
    scoreCorrect++;
    feedbackEl.innerHTML = `<strong>إجابة صحيحة!</strong> ${q.explanation}`;
    feedbackEl.classList.add('correct-fb');
  } else {
    optDiv.classList.add('wrong');
    allOpts[q.correct].classList.add('correct');
    scoreWrong++;
    feedbackEl.innerHTML = `<strong>إجابة خاطئة!</strong> ${q.explanation}`;
    feedbackEl.classList.add('wrong-fb');
  }
  
  scoreCardC.innerText = scoreCorrect;
  scoreCardW.innerText = scoreWrong;
  
  feedbackEl.style.display = 'block';
  
  barFill.style.width = `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%`;
  
  if (currentQuestionIndex < currentQuestions.length - 1) {
    nextBtn.innerText = 'السؤال التالي';
  } else {
    nextBtn.innerText = 'عرض النتيجة';
  }
  nextBtn.style.display = 'inline-block';
}

function nextAction() {
  if (currentQuestionIndex < currentQuestions.length - 1) {
    currentQuestionIndex++;
    loadQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  qBox.style.display = 'none';
  resultBox.style.display = 'block';
  nextBtn.style.display = 'none';
  
  let total = currentQuestions.length;
  let pct = Math.round((scoreCorrect / total) * 100);
  
  document.getElementById('quiz-rs-pct').innerText = pct + '%';
  document.getElementById('quiz-rs-c').innerText = scoreCorrect;
  document.getElementById('quiz-rs-w').innerText = scoreWrong;
  
  let circle = document.getElementById('quiz-rs-circle');
  circle.style.background = `conic-gradient(#10b981 0%, #10b981 ${pct}%, rgba(255,255,255,0.05) ${pct}%)`;
  
  let evalText = "";
  if (pct >= 90) evalText = "ممتاز — أداء استثنائي!";
  else if (pct >= 75) evalText = "جيد جداً — مستوى احترافي!";
  else if (pct >= 60) evalText = "جيد — أداء مرضي!";
  else if (pct >= 40) evalText = "متوسط — تحتاج لمراجعة بعض المفاهيم.";
  else evalText = "ضعيف — يرجى مراجعة الفصل مرة أخرى.";
  
  document.getElementById('quiz-rs-eval').innerText = evalText;
  
  // Update review system conditions
  localStorage.setItem('quizFinished', 'true');
  if (typeof window.triggerReviewAfterQuiz === 'function') {
      window.triggerReviewAfterQuiz();
  }
}

function restartQuiz() {
  openQuiz(currentChapter);
}
