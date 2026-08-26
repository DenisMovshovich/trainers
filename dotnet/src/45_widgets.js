/* ============================================================
   Конструкторы: устойчивость локатора и диагностика флака
   ============================================================ */
const LOC_KINDS = [
 {id:"role",  t:'GetByRole("button", new(){ Name = "Отправить" })', s:5,
  why:"Роль и доступное имя — то, что видит и пользователь, и экранная читалка. Переживает перевёрстку, смену классов и обёртки."},
 {id:"label", t:'GetByLabel("E-mail")', s:5,
  why:"Привязка к подписи поля. Ломается только вместе со сменой текста подписи — а это заметное изменение, которое и должно ломать тест."},
 {id:"testid",t:'GetByTestId("submit-btn")', s:5,
  why:"Явный контракт с разработкой. Самый устойчивый вариант, но требует договорённости: атрибут должен кто-то проставить и не удалять."},
 {id:"id",    t:'Locator("#email")', s:4,
  why:"Идентификатор обычно стабилен. Риск один: сгенерированные фреймворком идентификаторы вида #mat-input-3 меняются от порядка элементов."},
 {id:"text",  t:'GetByText("Спасибо за заявку")', s:3,
  why:"Работает, пока не поменяли формулировку или не добавили вторую локаль. Для проверок текста — уместно, для навигации — рискованно."},
 {id:"css",   t:'Locator("button.btn.btn-primary.submit")', s:2,
  why:"Цепочка классов — это описание оформления, а не назначения. Смена темы или рефакторинг стилей ломает такой локатор молча."},
 {id:"nth",   t:'Locator("input").Nth(2)', s:1,
  why:"Привязка к порядку. Добавили поле выше — тест начал заполнять не то, и падение произойдёт не здесь, а дальше по сценарию."},
 {id:"xpath", t:'Locator("//div[3]/form/input[1]")', s:1,
  why:"Привязка к структуре документа. Ломается от добавления обёртки, не меняющей вид страницы. Последнее средство."}
];
function widgetLoc(){
  return '<div class="tool" data-w="loc">'+
    '<div class="tool-h">Устойчивость локатора</div>'+
    '<div class="tool-b"><p class="wnote">Выберите способ — увидите оценку и объяснение. Порядок в списке случайный, не подсказывает.</p>'+
    '<div class="lgrid">'+ LOC_KINDS.map((k,i)=>
      '<button class="lbtn" data-i="'+i+'"><code>'+esc(k.t)+'</code></button>').join("") +'</div>'+
    '<div class="lout" hidden></div></div></div>';
}
function wireLoc(root){
  root.querySelectorAll('[data-w="loc"]').forEach(box=>{
    const out = box.querySelector(".lout");
    box.querySelectorAll(".lbtn").forEach(b=>b.onclick=()=>{
      const k = LOC_KINDS[+b.dataset.i];
      box.querySelectorAll(".lbtn").forEach(x=>x.classList.toggle("on", x===b));
      const bars = "●".repeat(k.s) + "○".repeat(5-k.s);
      const cls = k.s>=4 ? "g" : k.s===3 ? "w" : "b";
      out.hidden = false;
      out.className = "lout "+cls;
      out.innerHTML = '<div class="lscore">Устойчивость <b>'+bars+'</b> '+k.s+' из 5</div><p>'+k.why+'</p>';
    });
  });
}

const FLAKY_SYM = [
 {id:"sleep", t:"Рядом стоит WaitForTimeoutAsync или Thread.Sleep",
  d:"Ожидание времени вместо условия", f:"Заменить на ожидание условия: Expect(loc).ToBeVisibleAsync(), WaitForURLAsync, WaitForResponseAsync."},
 {id:"pred",  t:"В утверждении вызывается IsVisibleAsync или TextContentAsync",
  d:"Проверка без ожидания", f:"Предикаты возвращают состояние на текущий момент. Использовать Expect(...) — он ждёт до таймаута."},
 {id:"nth",   t:"В локаторе есть .First, .Last или .Nth(...)",
  d:"Неоднозначный локатор", f:"Сузить контекстом родителя вместо выбора по порядку: GetByTestId(\"form\").GetByRole(\"button\")."},
 {id:"twice", t:"Падает при втором запуске подряд, первый проходит",
  d:"Зависимость от данных", f:"Уникальные данные на прогон (Guid в адресе), очистка созданного в TearDown."},
 {id:"suite", t:"По одному проходит, вместе с фикстурой падает",
  d:"Зависимость от порядка или общее состояние", f:"Убрать изменяемое общее состояние из OneTimeSetUp; каждый тест готовит себе данные сам."},
 {id:"ci",    t:"Локально проходит, в CI падает",
  d:"Отличие окружения", f:"Сверить размер окна, скорость агента, часовой пояс, доступность стенда. Сохранять трейс в артефакты."},
 {id:"night", t:"Падает ночью, в конце месяца или после перевода часов",
  d:"Зависимость от времени", f:"Не полагаться на «сегодня»: фиксировать время в контексте, брать граничные даты явно."},
 {id:"ext",   t:"Падает одновременно с недоступностью внешнего сервиса",
  d:"Зависимость от чужой системы", f:"Подменять ответ через перехват сети либо выносить такие проверки в отдельный набор."},
 {id:"manual",t:"Воспроизводится руками, если повторить быстро",
  d:"Похоже на настоящую гонку в продукте", f:"Это дефект, а не флак. Завести баг; ретрай здесь недопустим — он спрячет проблему навсегда."}
];
function widgetFlaky(){
  return '<div class="tool" data-w="flaky">'+
    '<div class="tool-h">Диагностика плавающего теста</div>'+
    '<div class="tool-b"><p class="wnote">Отметьте наблюдаемые признаки — получите вероятные причины в порядке проверки.</p>'+
    '<div class="fsyms">'+ FLAKY_SYM.map((s,i)=>
      '<label class="fsym"><input type="checkbox" data-i="'+i+'"><span>'+esc(s.t)+'</span></label>').join("") +'</div>'+
    '<div class="fout"><p class="wnote">Ничего не отмечено.</p></div></div></div>';
}
function wireFlaky(root){
  root.querySelectorAll('[data-w="flaky"]').forEach(box=>{
    const out = box.querySelector(".fout");
    const paint = ()=>{
      const on = [...box.querySelectorAll(".fsym input")].filter(x=>x.checked).map(x=>FLAKY_SYM[+x.dataset.i]);
      if(!on.length){ out.innerHTML = '<p class="wnote">Ничего не отмечено.</p>'; return; }
      out.innerHTML = '<div class="fh">Проверять в этом порядке</div>' + on.map((s,i)=>
        '<div class="frow"><span class="fn">'+(i+1)+'</span><div><b>'+esc(s.d)+'</b><p>'+esc(s.f)+'</p></div></div>').join("") +
        (on.some(s=>s.id==="manual") ? '<div class="fwarn">Среди признаков есть тот, который указывает на дефект продукта. Начните с него: ретрай здесь недопустим.</div>' : "");
    };
    box.querySelectorAll(".fsym input").forEach(c=>c.onchange = paint);
    paint();
  });
}

WIDGETS.loc = [widgetLoc, wireLoc];
WIDGETS.flaky = [widgetFlaky, wireFlaky];
