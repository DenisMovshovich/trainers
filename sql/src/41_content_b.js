/* ------------------------------------------------ 3 */
{
n:3, id:"null", title:"NULL", sub:"Трёхзначная логика",
lede:"NULL — не ноль и не пустая строка, а «значение неизвестно». Из этого следует логика с тремя исходами и десяток ловушек.",
theory:`
<p>NULL означает <b>отсутствие значения</b>. Не «пусто», не «ноль» — именно «неизвестно». Как только это принято, всё остальное выводится логически: любое сравнение с неизвестным даёт неизвестный результат.</p>

<h2>Три исхода вместо двух</h2>
<figure class="fig">
<svg viewBox="0 0 620 196" role="img" aria-label="Таблицы истинности AND и OR с NULL">
 <g font-family="var(--fm)" font-size="10">
  <text x="0" y="12" font-weight="700" fill="var(--acc)">AND</text>
  ${[["","TRUE","FALSE","NULL"],["TRUE","TRUE","FALSE","NULL"],["FALSE","FALSE","FALSE","FALSE"],["NULL","NULL","FALSE","NULL"]]
    .map((row,ri)=>row.map((cell,ci)=>{
      const x = ci*68, y = 20 + ri*30;
      const head = ri===0||ci===0;
      const fill = head ? "var(--surf2)" : (cell==="TRUE"?"var(--ok-s)":cell==="FALSE"?"var(--surf3)":"var(--warn-s)");
      return '<rect x="'+x+'" y="'+y+'" width="66" height="27" fill="'+fill+'" stroke="var(--line)"/>'+
             '<text x="'+(x+33)+'" y="'+(y+18)+'" text-anchor="middle" font-size="9.5" fill="var(--ink)">'+cell+'</text>';
    }).join("")).join("")}
  <text x="330" y="12" font-weight="700" fill="var(--acc)">OR</text>
  ${[["","TRUE","FALSE","NULL"],["TRUE","TRUE","TRUE","TRUE"],["FALSE","TRUE","FALSE","NULL"],["NULL","TRUE","NULL","NULL"]]
    .map((row,ri)=>row.map((cell,ci)=>{
      const x = 330 + ci*68, y = 20 + ri*30;
      const head = ri===0||ci===0;
      const fill = head ? "var(--surf2)" : (cell==="TRUE"?"var(--ok-s)":cell==="FALSE"?"var(--surf3)":"var(--warn-s)");
      return '<rect x="'+x+'" y="'+y+'" width="66" height="27" fill="'+fill+'" stroke="var(--line)"/>'+
             '<text x="'+(x+33)+'" y="'+(y+18)+'" text-anchor="middle" font-size="9.5" fill="var(--ink)">'+cell+'</text>';
    }).join("")).join("")}
  <text x="0" y="192" font-size="9.5" fill="var(--ink3)">WHERE оставляет строку, только если условие TRUE. И FALSE, и NULL одинаково означают «не показывать».</text>
 </g>
</svg>
<figcaption>Два места, где неизвестность «схлопывается»: FALSE AND что угодно = FALSE, TRUE OR что угодно = TRUE.</figcaption>
</figure>

<h2>Как проверять на NULL</h2>
<pre><code><span class="c">-- никогда не сработает: результат сравнения — NULL, а не TRUE</span>
<span class="k">WHERE</span> city = <span class="k">NULL</span>

<span class="c">-- правильно</span>
<span class="k">WHERE</span> city <span class="k">IS NULL</span>
<span class="k">WHERE</span> city <span class="k">IS NOT NULL</span></code></pre>

<h2>Работа со значением по умолчанию</h2>
<div class="tw"><table>
<tr><th>Функция</th><th>Что делает</th></tr>
<tr><td><code>COALESCE(a, b, c)</code></td><td>первое не-NULL из списка</td></tr>
<tr><td><code>NULLIF(a, b)</code></td><td>NULL, если a = b, иначе a. Удобно против деления на ноль</td></tr>
<tr><td><code>a IS DISTINCT FROM b</code></td><td>сравнение, в котором два NULL считаются одинаковыми</td></tr>
</table></div>
<pre><code><span class="k">SELECT</span> name, <span class="k">COALESCE</span>(city, 'город не указан') <span class="k">AS</span> город <span class="k">FROM</span> customers;
<span class="k">SELECT</span> sum(a) / <span class="k">NULLIF</span>(count(b), 0) <span class="k">AS</span> среднее <span class="k">FROM</span> t;   <span class="c">-- вместо ошибки вернёт NULL</span></code></pre>

<h2>NULL в агрегатах</h2>
<div class="note"><b class="hd">Агрегаты пропускают NULL — кроме COUNT(*)</b><p><code>COUNT(*)</code> считает <b>строки</b>. <code>COUNT(city)</code> считает строки, где <code>city</code> не NULL. <code>AVG</code> делит на количество не-NULL значений, а не на число строк — поэтому среднее по столбцу с пропусками не равно «сумма делить на количество строк».</p></div>
<pre><code><span class="k">SELECT</span> count(*) <span class="k">AS</span> всего, count(city) <span class="k">AS</span> с_городом <span class="k">FROM</span> customers;
<span class="c">-- 8 и 6: двое клиентов без города</span></code></pre>

<h2>Главная ловушка: NOT IN</h2>
<div class="note trap"><b class="hd">NOT IN с NULL в списке не вернёт ничего</b>
<pre style="margin:.5em 0"><code><span class="k">SELECT</span> * <span class="k">FROM</span> customers
<span class="k">WHERE</span> id <span class="k">NOT IN</span> (<span class="k">SELECT</span> manager_id <span class="k">FROM</span> employees);</code></pre>
<p>Если хоть один <code>manager_id</code> равен NULL, результат пуст <b>всегда</b>. Логика безупречна: «id не равен ни одному из списка» разворачивается в цепочку <code>id &lt;&gt; a AND id &lt;&gt; b AND id &lt;&gt; NULL</code>, а последнее звено даёт NULL, и всё выражение перестаёт быть истинным.</p>
<p>Лечится тремя способами: <code>NOT EXISTS</code> (предпочтительно), <code>WHERE manager_id IS NOT NULL</code> внутри подзапроса, либо <code>LEFT JOIN … WHERE ключ IS NULL</code>.</p></div>

<h2>Где NULL ведёт себя иначе</h2>
<div class="tw"><table>
<tr><th>Место</th><th>Поведение</th></tr>
<tr><td><code>WHERE</code></td><td>NULL = не показывать, как и FALSE</td></tr>
<tr><td><code>GROUP BY</code></td><td>все NULL попадают в <b>одну</b> группу</td></tr>
<tr><td><code>ORDER BY</code></td><td>по возрастанию NULL идут <b>последними</b>, по убыванию — первыми</td></tr>
<tr><td><code>UNIQUE</code></td><td>несколько NULL <b>не</b> считаются дубликатами</td></tr>
<tr><td><code>UNION</code>, <code>DISTINCT</code></td><td>два NULL считаются <b>одинаковыми</b></td></tr>
</table></div>
<p>Обратите внимание на противоречие между двумя последними строками: для ограничения уникальности NULL-ы разные, а для устранения дубликатов — одинаковые. Это не ошибка стандарта, а разные вопросы: «известно ли, что значения совпадают» против «выглядят ли строки одинаково».</p>
`,
quiz:[
 {q:"Что вернёт <code>WHERE city = NULL</code>?",
  opts:["Строки, где город не заполнен","Ничего: сравнение даёт NULL, а WHERE требует TRUE","Все строки","Ошибку"],
  a:1, why:"Сравнение с неизвестным даёт неизвестное. Проверка на отсутствие значения — только <code>IS NULL</code>."},
 {q:"<code>SELECT count(*), count(city) FROM customers</code> вернул 8 и 6. Почему числа разные?",
  opts:["Ошибка в данных","<code>count(*)</code> считает строки, <code>count(city)</code> — только не-NULL значения","count(city) считает уникальные","Так работает только в PostgreSQL"],
  a:1, why:"Агрегаты пропускают NULL. Единственное исключение — <code>count(*)</code>, который считает строки и не смотрит на значения."},
 {q:"Почему <code>id NOT IN (SELECT manager_id FROM employees)</code> может вернуть пусто?",
  opts:["Подзапрос слишком большой","Если в списке есть NULL, условие никогда не станет истинным","NOT IN не работает с подзапросами","Нужен DISTINCT"],
  a:1, why:"Цепочка <code>id &lt;&gt; …</code> содержит сравнение с NULL, которое даёт NULL, и всё И-выражение перестаёт быть истинным. Надёжная замена — <code>NOT EXISTS</code>."},
 {q:"Как ведут себя NULL в <code>GROUP BY</code>?",
  opts:["Каждый NULL образует свою группу","Все NULL попадают в одну группу","Строки с NULL отбрасываются","Возникает ошибка"],
  a:1, why:"Для группировки NULL-ы считаются одинаковыми — в отличие от ограничения UNIQUE, где они считаются разными."},
 {q:"Что делает <code>NULLIF(count(b), 0)</code> в знаменателе?",
  opts:["Заменяет NULL на ноль","Превращает ноль в NULL, и деление вернёт NULL вместо ошибки","Округляет результат","Считает только ненулевые"],
  a:1, why:"Деление на NULL даёт NULL — это лучше, чем прерывание запроса ошибкой деления на ноль."},
 {q:"Сколько строк с NULL пропустит уникальный индекс по столбцу?",
  opts:["Только одну","Сколько угодно: NULL-ы не считаются дубликатами","Ни одной","Зависит от настроек"],
  a:1, why:"Два неизвестных значения не обязаны быть равны, поэтому UNIQUE их не сравнивает. С версии 15 это поведение можно изменить через NULLS NOT DISTINCT."}
],
labs:[
 {id:"3a", title:"Найти пропуски",
  brief:"<h3>Найти пропуски</h3><p>У двух клиентов не заполнен город.</p><ul><li>Попробуйте <code>WHERE city = NULL</code> — вернётся пусто</li><li>Теперь <code>WHERE city IS NULL</code> — найдутся двое</li><li>Посчитайте <code>count(*)</code> и <code>count(city)</code> одним запросом — увидите 8 и 6</li><li>Выведите имя и город, подставив «не указан» вместо пропуска</li><li>Проверьте, что <code>city &lt;&gt; 'Лондон'</code> находит 4 строки, а не 6</li></ul>",
  hint:"COALESCE(city, 'не указан') подставляет запасное значение. Двое без города не попадают ни в равенство, ни в неравенство.",
  checks:[
   {label:"Попытка <code>= NULL</code> вернула пусто", test:st=>st.log.some(e=>!e.err&&/=\s*null/i.test(e.sql)&&e.res&&e.res.rows.length===0)},
   {label:"<code>IS NULL</code> нашла двоих", test:st=>ran(st,/is\s+null/i)&&answer(st,rows=>rows.length===2)},
   {label:"Показана разница <code>count(*)</code> и <code>count(city)</code>", test:st=>answer(st,rows=>rows.length===1&&rows[0].includes(8)&&rows[0].includes(6))},
   {label:"Пропуск заменён через <code>COALESCE</code>", test:st=>ran(st,/coalesce/i)&&answer(st,rows=>rows.length===8&&rows.some(r=>r.some(v=>/не указан/i.test(String(v)))))},
   {label:"Показано, что <code>&lt;&gt;</code> даёт 4, а не 6", test:st=>answer(st,rows=>rows.length===1&&rows[0][0]===4)}
  ]},
 {id:"3b", title:"Ловушка NOT IN",
  brief:"<h3>Ловушка NOT IN</h3><p>У руководителя компании нет начальника — <code>manager_id</code> у него NULL. Посмотрим, что из этого следует.</p><ul><li>Выполните <code>SELECT count(*) FROM employees WHERE id NOT IN (SELECT manager_id FROM employees);</code> — получите ноль</li><li>Убедитесь, что NULL там действительно есть: посчитайте <code>count(*)</code> и <code>count(manager_id)</code></li><li>Почините через <code>NOT EXISTS</code> — должно найтись 5 сотрудников, которые никем не руководят</li><li>Почините вторым способом: добавьте <code>WHERE manager_id IS NOT NULL</code> внутрь подзапроса</li></ul>",
  hint:"NOT EXISTS: ... WHERE NOT EXISTS (SELECT 1 FROM employees m WHERE m.manager_id = e.id)",
  checks:[
   {label:"<code>NOT IN</code> ожидаемо вернул ноль", test:st=>st.log.some(e=>!e.err&&/not\s+in/i.test(e.sql)&&e.res&&e.res.rows.length===1&&e.res.rows[0][0]===0)},
   {label:"Показано наличие NULL в <code>manager_id</code>", test:st=>answer(st,rows=>rows.length===1&&rows[0].includes(9)&&rows[0].includes(8))},
   {label:"Починено через <code>NOT EXISTS</code> — 5 сотрудников", test:st=>ran(st,/not\s+exists/i)&&answer(st,rows=>rows.length===1&&rows[0][0]===5||rows.length===5)},
   {label:"Починено через <code>IS NOT NULL</code> в подзапросе", test:st=>st.log.some(e=>!e.err&&/not\s+in[\s\S]*is\s+not\s+null/i.test(e.sql)&&e.res&&e.res.rows.length&&e.res.rows[0][0]!==0)}
  ]}
]
},

/* ------------------------------------------------ 4 */
{
n:4, id:"order", title:"Сортировка и выборка", sub:"ORDER BY, LIMIT, DISTINCT",
lede:"Как упорядочить результат, чем опасен LIMIT без ORDER BY и почему DISTINCT — обычно симптом, а не решение.",
theory:`
<h2>ORDER BY</h2>
<pre><code><span class="k">SELECT</span> title, price <span class="k">FROM</span> products
<span class="k">ORDER BY</span> price <span class="k">DESC</span>, title <span class="k">ASC</span>;</code></pre>
<p>Сортировать можно по столбцу, выражению, псевдониму из списка выборки или по номеру позиции (<code>ORDER BY 2</code>). Номера удобны в консоли и вредны в коде: добавили столбец — сортировка поехала.</p>

<h2>NULL при сортировке</h2>
<div class="tw"><table>
<tr><th>Запись</th><th>Где окажутся NULL</th></tr>
<tr><td><code>ORDER BY city</code></td><td>в конце (по возрастанию умолчание — NULLS LAST)</td></tr>
<tr><td><code>ORDER BY city DESC</code></td><td>в начале</td></tr>
<tr><td><code>ORDER BY city NULLS FIRST</code></td><td>в начале, явно</td></tr>
</table></div>
<p>PostgreSQL считает NULL «больше» любого значения — отсюда и умолчания. В других СУБД умолчание другое, поэтому в переносимом коде положение NULL задают явно.</p>

<h2>LIMIT и OFFSET</h2>
<pre><code><span class="k">SELECT</span> * <span class="k">FROM</span> products <span class="k">ORDER BY</span> id <span class="k">LIMIT</span> 10 <span class="k">OFFSET</span> 20;</code></pre>
<div class="note trap"><b class="hd">LIMIT без ORDER BY — недетерминированный результат</b><p>«Первые 10» без сортировки означает «те 10, которые база вернула быстрее». Набор может измениться после обновления строки, смены плана или добавления индекса — при том же запросе и тех же данных. Если есть LIMIT, обязан быть ORDER BY.</p></div>
<div class="note warn"><b class="hd">И сортировка должна быть однозначной</b><p><code>ORDER BY price LIMIT 10</code> при одинаковых ценах тоже неустойчив: какие именно строки попадут в десятку, не определено. Добавляйте уникальный столбец последним ключом: <code>ORDER BY price, id</code>.</p></div>
<p>Отдельная проблема — <code>OFFSET</code> на больших числах: чтобы отдать строки с 100000-й, база вынуждена пройти и отбросить предыдущие сто тысяч. Для листания по большим наборам применяют «клавишный» способ: <code>WHERE (price, id) &gt; (последняя_цена, последний_id) ORDER BY price, id LIMIT 10</code>.</p>

<h2>DISTINCT</h2>
<pre><code><span class="k">SELECT DISTINCT</span> category <span class="k">FROM</span> products;</code></pre>
<p><code>DISTINCT</code> убирает полностью совпадающие строки результата — он применяется ко <b>всему списку выборки</b>, а не к одному столбцу.</p>
<div class="note"><b class="hd">DISTINCT чаще всего лечит симптом</b><p>Если он появился в запросе с соединениями, обычно это значит, что соединение размножило строки: одна запись слева совпала с несколькими справа. <code>DISTINCT</code> убирает дубликаты, но платит за это сортировкой или хешированием всего результата, и настоящая причина остаётся. Правильнее посмотреть, какое соединение размножает строки, и заменить его на <code>EXISTS</code> или агрегат.</p></div>
<p>Есть и специфичная для PostgreSQL форма <code>DISTINCT ON (столбец)</code>: она оставляет по одной строке на каждое значение столбца — первую в порядке <code>ORDER BY</code>. Удобно для «последней записи на каждого клиента».</p>
`,
quiz:[
 {q:"Где окажутся NULL при <code>ORDER BY city</code> в PostgreSQL?",
  opts:["В начале","В конце","Отбрасываются","Порядок не определён"],
  a:1, why:"PostgreSQL считает NULL больше любого значения, поэтому при возрастании они идут последними. В других СУБД умолчание может отличаться — пишите NULLS FIRST/LAST явно."},
 {q:"Чем плох <code>LIMIT 10</code> без <code>ORDER BY</code>?",
  opts:["Работает медленнее","Результат недетерминирован: какие именно 10 строк — не определено","Вернёт ошибку","Вернёт все строки"],
  a:1, why:"Порядок без сортировки зависит от плана, физического расположения строк и истории обновлений. При тех же данных ответ может измениться."},
 {q:"<code>ORDER BY price LIMIT 10</code> при одинаковых ценах:",
  opts:["Всегда даёт один и тот же набор","Тоже неустойчив — нужен уникальный столбец в конце ключа","Автоматически добавляет id","Вернёт ошибку неоднозначности"],
  a:1, why:"Строки с равными ключами база вправе вернуть в любом порядке. Добавление <code>, id</code> делает сортировку полной и результат воспроизводимым."},
 {q:"К чему применяется <code>DISTINCT</code>?",
  opts:["К первому столбцу списка выборки","Ко всей строке результата целиком","К столбцу, указанному после него","К таблице до фильтрации"],
  a:1, why:"Именно поэтому добавление ещё одного столбца в SELECT может «сломать» устранение дубликатов: строки перестают совпадать целиком."},
 {q:"В запросе с JOIN понадобился DISTINCT. О чём это обычно говорит?",
  opts:["О необходимости индекса","О том, что соединение размножило строки, и причину стоит устранить","О неверном типе данных","Ни о чём, это нормально"],
  a:1, why:"Обычно одна строка слева совпадает с несколькими справа. Если правая таблица нужна лишь для проверки существования, её место — в <code>EXISTS</code>, а не в JOIN."},
 {q:"Почему <code>OFFSET 100000</code> медленный?",
  opts:["База сортирует дважды","Приходится пройти и отбросить все предыдущие строки","OFFSET не использует индексы вообще","Из-за блокировок"],
  a:1, why:"Отбрасывание всё равно требует их прочитать. Для глубокого листания применяют условие на ключ последней показанной строки."}
],
labs:[
 {id:"4a", title:"Упорядочить и ограничить",
  brief:"<h3>Упорядочить и ограничить</h3><ul><li>Три самых дорогих товара</li><li>Три самых дешёвых, при равенстве цены — по названию</li><li>Клиенты, отсортированные по городу, пропуски — в начале</li><li>Список уникальных категорий</li><li>Товары с 4-го по 6-й по возрастанию цены (подсказка: LIMIT и OFFSET)</li></ul>",
  hint:"NULLS FIRST ставится после имени столбца в ORDER BY. Для «с 4-го по 6-й» нужен OFFSET 3 LIMIT 3.",
  checks:[
   {label:"Три самых дорогих товара", test:st=>answer(st,rows=>rows.length===3&&rows[0].some(v=>v===129900))},
   {label:"Сортировка по двум ключам", test:st=>ran(st,/order\s+by[^;]*,[^;]*/i)},
   {label:"NULL выведены первыми", test:st=>ran(st,/nulls\s+first/i)&&answer(st,rows=>rows.length===8&&rows[0].some(v=>v===null))},
   {label:"Получен список уникальных категорий", test:st=>ran(st,/distinct/i)&&answer(st,rows=>rows.length===4)},
   {label:"Использованы <code>LIMIT</code> и <code>OFFSET</code>", test:st=>ran(st,/offset/i)&&answer(st,rows=>rows.length===3)}
  ]},
 {id:"4b", title:"Неустойчивая выборка",
  brief:"<h3>Неустойчивая выборка</h3><p>Покажите себе, почему сортировка должна быть полной.</p><ul><li>Выполните <code>SELECT title, category FROM products ORDER BY category LIMIT 3;</code> — сортировка по одному ключу</li><li>Выведите все товары с <code>ORDER BY category, id</code></li><li>Теперь все товары с <code>ORDER BY category, title</code></li><li>Сравните два последних результата: внутри одной категории порядок разный, хотя ключ сортировки <code>category</code> одинаковый</li></ul><p>Смысл не в том, что первый запрос вернёт «неправильное», — а в том, что его результат ничем не гарантирован.</p>",
  hint:"Обратите внимание на блок «периферия»: по id и по названию товары идут в разном порядке.",
  checks:[
   {label:"Выполнена сортировка по одному ключу с <code>LIMIT</code>", test:st=>st.log.some(e=>!e.err&&/order\s+by\s+category\s+limit/i.test(e.sql))},
   {label:"Добавлен второй ключ <code>id</code>", test:st=>st.log.some(e=>!e.err&&/order\s+by\s+category\s*,\s*id/i.test(e.sql)&&e.res&&e.res.rows.length===10)},
   {label:"Проверен вариант со вторым ключом <code>title</code>", test:st=>st.log.some(e=>!e.err&&/order\s+by\s+category\s*,\s*title/i.test(e.sql)&&e.res&&e.res.rows.length===10)},
   {label:"Порядки внутри категории получились разными", test:st=>{
     const a = st.log.find(e=>!e.err&&/order\s+by\s+category\s*,\s*id/i.test(e.sql)&&e.res&&e.res.rows.length===10);
     const b = st.log.find(e=>!e.err&&/order\s+by\s+category\s*,\s*title/i.test(e.sql)&&e.res&&e.res.rows.length===10);
     return a&&b&&JSON.stringify(a.res.rows)!==JSON.stringify(b.res.rows);}}
  ]}
]
},

/* ------------------------------------------------ 5 */
{
n:5, id:"agg", title:"Агрегаты и GROUP BY", sub:"Свёртка строк",
lede:"Как посчитать по группам, чем WHERE отличается от HAVING и почему нельзя выбрать столбец, которого нет в GROUP BY.",
theory:`
<p><b>Агрегат</b> сворачивает множество строк в одно значение. Без <code>GROUP BY</code> вся выборка считается одной группой.</p>
<div class="tw"><table>
<tr><th>Функция</th><th>Что делает</th><th>NULL</th></tr>
<tr><td><code>count(*)</code></td><td>число строк</td><td>считает все</td></tr>
<tr><td><code>count(col)</code></td><td>число непустых значений</td><td>пропускает</td></tr>
<tr><td><code>count(DISTINCT col)</code></td><td>число различных непустых значений</td><td>пропускает</td></tr>
<tr><td><code>sum</code>, <code>avg</code></td><td>сумма, среднее</td><td>пропускают</td></tr>
<tr><td><code>min</code>, <code>max</code></td><td>минимум, максимум</td><td>пропускают</td></tr>
<tr><td><code>string_agg(col, ', ')</code></td><td>склейка значений в строку</td><td>пропускает</td></tr>
</table></div>
<div class="note"><b class="hd">Пустая выборка: count даёт 0, sum даёт NULL</b><p>Это логично: строк ноль — значит их количество ноль, а сумма несуществующих значений неизвестна. В отчётах поэтому пишут <code>COALESCE(sum(x), 0)</code>.</p></div>

<h2>GROUP BY</h2>
<pre><code><span class="k">SELECT</span> category, count(*) <span class="k">AS</span> шт, round(avg(price)) <span class="k">AS</span> средняя
<span class="k">FROM</span> products
<span class="k">GROUP BY</span> category
<span class="k">ORDER BY</span> шт <span class="k">DESC</span>;</code></pre>
<div class="note trap"><b class="hd">Правило, которое ловит всех новичков</b><p>В списке выборки можно использовать <b>только</b> столбцы из <code>GROUP BY</code> и агрегаты. Запрос <code>SELECT category, title, count(*) … GROUP BY category</code> будет отвергнут: в группе «периферия» пять разных названий, и какое из них показать — вопрос без ответа. Если название нужно, выбирайте его агрегатом (<code>min(title)</code>, <code>string_agg</code>) либо добавляйте в группировку.</p></div>

<h2>WHERE против HAVING</h2>
<figure class="fig">
<svg viewBox="0 0 620 150" role="img" aria-label="Где применяются WHERE и HAVING">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="20" width="130" height="44" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="65" y="40" text-anchor="middle" fill="var(--ink)">строки</text>
  <text x="65" y="55" text-anchor="middle" font-size="9" fill="var(--ink3)">из таблиц</text>
  <path d="M134 42h38" stroke="var(--acc)" stroke-width="1.3"/><path d="M172 42l-8-4.5v9z" fill="var(--acc)"/>
  <text x="153" y="34" text-anchor="middle" font-size="9" fill="var(--acc)">WHERE</text>
  <rect x="176" y="20" width="130" height="44" rx="3" fill="var(--acc-s)" stroke="var(--acc)"/>
  <text x="241" y="40" text-anchor="middle" fill="var(--ink)">отобранные</text>
  <text x="241" y="55" text-anchor="middle" font-size="9" fill="var(--ink3)">строки</text>
  <path d="M310 42h38" stroke="var(--acc)" stroke-width="1.3"/><path d="M348 42l-8-4.5v9z" fill="var(--acc)"/>
  <text x="329" y="34" text-anchor="middle" font-size="9" fill="var(--acc)">GROUP BY</text>
  <rect x="352" y="20" width="120" height="44" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="412" y="40" text-anchor="middle" fill="var(--ink)">группы</text>
  <path d="M476 42h38" stroke="var(--acc)" stroke-width="1.3"/><path d="M514 42l-8-4.5v9z" fill="var(--acc)"/>
  <text x="495" y="34" text-anchor="middle" font-size="9" fill="var(--acc)">HAVING</text>
  <rect x="518" y="20" width="102" height="44" rx="3" fill="var(--ok-s)" stroke="var(--ok)"/>
  <text x="569" y="46" text-anchor="middle" fill="var(--ink)">результат</text>
  <text x="0" y="94" font-size="9.5" fill="var(--ink2)">WHERE отбирает строки ДО группировки — агрегатов там ещё нет и быть не может.</text>
  <text x="0" y="110" font-size="9.5" fill="var(--ink2)">HAVING отбирает готовые группы — только там осмысленно условие вида count(*) &gt; 1.</text>
  <text x="0" y="132" font-size="9.5" fill="var(--ink3)">Условие, которое можно поставить в WHERE, туда и ставьте: до группировки строк меньше, работа дешевле.</text>
 </g>
</svg>
<figcaption>Два фильтра на разных этапах. Путаница между ними — вторая по частоте ошибка после NULL.</figcaption>
</figure>
<pre><code><span class="k">SELECT</span> customer_id, count(*) <span class="k">AS</span> заказов
<span class="k">FROM</span> orders
<span class="k">WHERE</span> status &lt;&gt; 'отменён'      <span class="c">-- отбор строк: до группировки</span>
<span class="k">GROUP BY</span> customer_id
<span class="k">HAVING</span> count(*) &gt;= 2;          <span class="c">-- отбор групп: после</span></code></pre>

<h2>Считать только часть</h2>
<p>Частая задача — в одной строке получить и общее число, и число по условию. Два способа:</p>
<pre><code><span class="k">SELECT</span>
  count(*) <span class="k">AS</span> всего,
  count(*) <span class="k">FILTER</span> (<span class="k">WHERE</span> status = 'доставлен') <span class="k">AS</span> доставлено,
  sum(<span class="k">CASE WHEN</span> status = 'отменён' <span class="k">THEN</span> 1 <span class="k">ELSE</span> 0 <span class="k">END</span>) <span class="k">AS</span> отменено
<span class="k">FROM</span> orders;</code></pre>
<p>Конструкция <code>FILTER</code> — стандарт SQL и поддерживается PostgreSQL; вариант с <code>CASE</code> переносим куда угодно. Оба обходятся одним проходом по таблице, в отличие от трёх отдельных запросов.</p>
`,
quiz:[
 {q:"Почему <code>SELECT category, title, count(*) FROM products GROUP BY category</code> — ошибка?",
  opts:["count нельзя сочетать со столбцами","В группе несколько разных title, и неизвестно, какой показать","Нужен ORDER BY","title имеет неверный тип"],
  a:1, why:"Каждая группа — это множество строк. Столбец, не входящий в ключ группировки, не имеет единственного значения на группу."},
 {q:"Где отбирать строки со статусом «отменён» перед подсчётом по клиентам?",
  opts:["В HAVING","В WHERE — до группировки","В ORDER BY","Всё равно"],
  a:1, why:"Условие на отдельную строку принадлежит WHERE. Отфильтровав раньше, вы и группируете меньше строк."},
 {q:"Что вернёт <code>sum(price)</code> по пустой выборке?",
  opts:["0","NULL","Ошибку","Пустую строку"],
  a:1, why:"Сумма несуществующих значений неизвестна. А вот <code>count(*)</code> вернёт 0 — количество строк определено всегда."},
 {q:"Чем <code>count(*)</code> отличается от <code>count(city)</code>?",
  opts:["Ничем","Первый считает строки, второй — только непустые значения столбца","Второй считает уникальные","Первый медленнее"],
  a:1, why:"Разница проявляется ровно там, где есть NULL, и именно этим пользуются, чтобы за один проход посчитать и строки, и заполненные значения."},
 {q:"Что делает <code>count(*) FILTER (WHERE status = 'доставлен')</code>?",
  opts:["Фильтрует всю выборку","Считает только строки, подходящие под условие, не влияя на остальные агрегаты","То же, что WHERE","Не поддерживается PostgreSQL"],
  a:1, why:"FILTER применяется к одному агрегату. Так в одной строке получают несколько срезов за один проход по таблице."},
 {q:"Можно ли писать агрегат в <code>WHERE</code>?",
  opts:["Да","Нет: на момент WHERE групп ещё не существует","Только с DISTINCT","Только в подзапросе"],
  a:1, why:"WHERE выполняется до группировки. Условия на результат агрегации ставятся в HAVING."}
],
labs:[
 {id:"5a", title:"Считать по группам",
  brief:"<h3>Считать по группам</h3><ul><li>Сколько товаров в каждой категории</li><li>Средняя цена по категориям, округлённая до целого</li><li>Сколько заказов у каждого клиента — по <code>customer_id</code></li><li>Клиенты, у которых <b>больше двух</b> заказов (должен быть один)</li><li>Общая сумма всех позиций заказов: <code>sum(qty * price)</code></li></ul>",
  hint:"Округление — round(avg(price)). Условие на количество заказов ставится в HAVING, а не в WHERE.",
  checks:[
   {label:"Подсчёт товаров по категориям", test:st=>ran(st,/group\s+by/i)&&answer(st,rows=>rows.length===4&&rows.some(r=>r.includes(5)))},
   {label:"Средняя цена по категориям", test:st=>ran(st,/avg/i)&&answer(st,rows=>rows.length===4)},
   {label:"Число заказов по клиентам", test:st=>answer(st,rows=>rows.length===6)},
   {label:"Использован <code>HAVING</code> и найден один клиент", test:st=>ran(st,/having/i)&&answer(st,rows=>rows.length===1)},
   {label:"Посчитана общая сумма позиций", test:st=>answer(st,rows=>rows.length===1&&rows[0][0]===559800)}
  ]},
 {id:"5b", title:"WHERE, HAVING и срезы",
  brief:"<h3>WHERE, HAVING и срезы</h3><ul><li>Посчитайте заказы по клиентам, <b>исключив отменённые</b> — условие должно стоять в WHERE</li><li>Из полученного оставьте клиентов с двумя и более заказами — это уже HAVING</li><li>Одним запросом по таблице <code>orders</code> получите три числа: всего, доставлено, отменено</li><li>Попробуйте поставить <code>count(*) &gt; 1</code> в WHERE — получите ошибку</li></ul>",
  hint:"Для трёх чисел в одной строке используйте count(*) FILTER (WHERE ...) или sum(CASE WHEN ... THEN 1 ELSE 0 END).",
  checks:[
   {label:"Отменённые исключены в <code>WHERE</code>", test:st=>st.log.some(e=>!e.err&&/where[\s\S]*отмен[\s\S]*group\s+by/i.test(e.sql))},
   {label:"Отбор групп через <code>HAVING</code>", test:st=>st.log.some(e=>!e.err&&/having[\s\S]*count/i.test(e.sql))},
   {label:"Получены три числа одной строкой", test:st=>answer(st,(rows,cols)=>rows.length===1&&cols.length>=3&&rows[0].includes(12))},
   {label:"Использован <code>FILTER</code> или <code>CASE</code>", test:st=>ran(st,/filter\s*\(|case\s+when/i)},
   {label:"Агрегат в <code>WHERE</code> дал ошибку", test:st=>st.log.some(e=>e.err&&/агрегат/i.test(e.err))}
  ]}
]
},

/* ------------------------------------------------ 6 */
{
n:6, id:"join", title:"Соединения", sub:"JOIN и его виды",
lede:"Как собрать данные из нескольких таблиц, чем LEFT отличается от INNER и почему условие в ON и в WHERE — не одно и то же.",
theory:`
<p><code>JOIN</code> ставит строки одной таблицы рядом со строками другой по условию. Условие пишется в <code>ON</code>.</p>
<pre><code><span class="k">SELECT</span> o.id, c.name, o.status
<span class="k">FROM</span> orders o
<span class="k">JOIN</span> customers c <span class="k">ON</span> c.id = o.customer_id;</code></pre>

<h2>Виды соединений</h2>
<div class="tw"><table>
<tr><th>Вид</th><th>Что оставляет</th><th>Когда нужен</th></tr>
<tr><td><code>INNER JOIN</code></td><td>только совпавшие пары</td><td>умолчание; слово INNER можно опустить</td></tr>
<tr><td><code>LEFT JOIN</code></td><td>все строки слева, справа NULL при отсутствии пары</td><td>«все клиенты и их заказы, если есть»</td></tr>
<tr><td><code>RIGHT JOIN</code></td><td>зеркально левому</td><td>редко: обычно понятнее поменять таблицы местами</td></tr>
<tr><td><code>FULL JOIN</code></td><td>все строки обеих таблиц</td><td>сверка двух источников</td></tr>
<tr><td><code>CROSS JOIN</code></td><td>все пары со всеми</td><td>генерация комбинаций; без условия</td></tr>
</table></div>

<h2>ON против WHERE при LEFT JOIN</h2>
<div class="note trap"><b class="hd">Одно и то же условие в двух местах даёт разный ответ</b>
<pre style="margin:.5em 0"><code><span class="c">-- 1) условие в ON: остаются ВСЕ клиенты, заказ подставляется только подходящий</span>
<span class="k">FROM</span> customers c <span class="k">LEFT JOIN</span> orders o <span class="k">ON</span> o.customer_id = c.id <span class="k">AND</span> o.status = 'отменён'

<span class="c">-- 2) условие в WHERE: LEFT превращается в INNER</span>
<span class="k">FROM</span> customers c <span class="k">LEFT JOIN</span> orders o <span class="k">ON</span> o.customer_id = c.id
<span class="k">WHERE</span> o.status = 'отменён'</code></pre>
<p>Во втором случае у клиентов без заказов <code>o.status</code> равен NULL, условие даёт NULL, и строка отбрасывается — внешнее соединение теряет смысл. Правило простое: условие на <b>правую</b> таблицу внешнего соединения принадлежит <code>ON</code>; в <code>WHERE</code> его ставят только сознательно, чтобы получить внутреннее соединение.</p></div>

<h2>Поиск того, чего нет</h2>
<pre><code><span class="c">-- клиенты без единого заказа</span>
<span class="k">SELECT</span> c.name
<span class="k">FROM</span> customers c
<span class="k">LEFT JOIN</span> orders o <span class="k">ON</span> o.customer_id = c.id
<span class="k">WHERE</span> o.id <span class="k">IS NULL</span>;</code></pre>
<p>Приём называется «антисоединение»: соединяем, а потом оставляем те строки, где пары не нашлось. Второй способ — <code>NOT EXISTS</code>; он обычно читается лучше и не размножает строки.</p>

<h2>Размножение строк</h2>
<div class="note warn"><b class="hd">JOIN может увеличить число строк — и испортить суммы</b><p>Если у заказа три позиции, соединение <code>orders JOIN order_items</code> даст три строки на заказ. Любая агрегация по такой выборке посчитает данные заказа трижды. Классический симптом: сумма по отчёту вдруг стала кратно больше правильной.</p><p>Лечится либо агрегацией по правильному ключу, либо агрегацией <b>до</b> соединения — в подзапросе или CTE.</p></div>

<h2>Соединение таблицы с собой</h2>
<pre><code><span class="k">SELECT</span> e.name <span class="k">AS</span> сотрудник, m.name <span class="k">AS</span> руководитель
<span class="k">FROM</span> employees e
<span class="k">LEFT JOIN</span> employees m <span class="k">ON</span> m.id = e.manager_id;</code></pre>
<p>Здесь псевдонимы обязательны: без них непонятно, о каком экземпляре таблицы идёт речь. <code>LEFT</code>, а не <code>INNER</code>, — иначе руководитель компании, у которого <code>manager_id</code> равен NULL, из отчёта исчезнет.</p>
`,
quiz:[
 {q:"Что вернёт LEFT JOIN для строки слева, у которой нет пары справа?",
  opts:["Ничего, строка отбрасывается","Строку, где столбцы правой таблицы равны NULL","Строку с нулями","Ошибку"],
  a:1, why:"В этом и смысл внешнего соединения: строки левой таблицы сохраняются, а отсутствующая половина заполняется NULL."},
 {q:"Почему условие на правую таблицу в WHERE превращает LEFT JOIN в INNER?",
  opts:["Так работает оптимизатор","У непарных строк значение справа NULL, условие даёт NULL, и строка отбрасывается","WHERE выполняется раньше JOIN","Это неверно, не превращает"],
  a:1, why:"Именно поэтому такие условия ставят в ON. Исключение — проверка <code>IS NULL</code>, которой и пользуются для антисоединения."},
 {q:"Как найти клиентов без заказов?",
  opts:["<code>INNER JOIN … WHERE o.id IS NULL</code>","<code>LEFT JOIN … WHERE o.id IS NULL</code> или <code>NOT EXISTS</code>","<code>CROSS JOIN</code>","<code>FULL JOIN … WHERE c.id IS NULL</code>"],
  a:1, why:"Внутреннее соединение уже отбросило бы таких клиентов, и условие оказалось бы бессмысленным."},
 {q:"У заказа три позиции. Сколько строк даст <code>orders JOIN order_items</code> для него?",
  opts:["Одну","Три","Три, но только с DISTINCT","Зависит от индексов"],
  a:1, why:"Соединение образует пары. Агрегация по такой выборке посчитает данные заказа трижды — отсюда завышенные суммы в отчётах."},
 {q:"Зачем псевдонимы при соединении таблицы с собой?",
  opts:["Для краткости","Без них невозможно различить два экземпляра одной таблицы","Так требует стандарт для всех JOIN","Чтобы работал индекс"],
  a:1, why:"Оба экземпляра называются одинаково, и ссылка вроде <code>id</code> станет неоднозначной."},
 {q:"Что делает <code>CROSS JOIN</code> без условия?",
  opts:["Соединяет по совпадающим именам столбцов","Даёт все пары: каждая строка слева с каждой справа","Возвращает объединение строк","Ошибка без ON"],
  a:1, why:"Число строк перемножается. Иногда это нужно осознанно — например, чтобы получить все сочетания дат и товаров."}
],
labs:[
 {id:"6a", title:"Собрать из таблиц",
  brief:"<h3>Собрать из таблиц</h3><ul><li>Список заказов с именем клиента (12 строк)</li><li>Все клиенты и число их заказов, включая тех, у кого заказов нет — 8 строк</li><li>Клиенты без единого заказа — 2 строки</li><li>Каждый сотрудник и имя его руководителя, включая директора — 9 строк</li></ul>",
  hint:"Чтобы клиенты без заказов не потерялись, нужен LEFT JOIN и count по столбцу заказа, а не count(*).",
  checks:[
   {label:"Заказы соединены с клиентами", test:st=>ran(st,/join/i)&&answer(st,rows=>rows.length===12)},
   {label:"Все 8 клиентов с числом заказов", test:st=>ran(st,/left\s+join/i)&&answer(st,rows=>rows.length===8)},
   {label:"У клиентов без заказов получился 0, а не 1", test:st=>answer(st,rows=>rows.length===8&&rows.filter(r=>r.includes(0)).length===2)},
   {label:"Найдены клиенты без заказов", test:st=>answer(st,rows=>rows.length===2)&&ran(st,/is\s+null|not\s+exists/i)},
   {label:"Сотрудники с руководителями, все 9", test:st=>ran(st,/employees\s+\w+[\s\S]*join\s+employees/i)&&answer(st,rows=>rows.length===9)}
  ]},
 {id:"6b", title:"ON против WHERE",
  brief:"<h3>ON против WHERE</h3><p>Одно условие, два места, разные ответы.</p><ul><li>Выполните LEFT JOIN клиентов с заказами, поставив <code>AND o.status = 'отменён'</code> в <b>ON</b>, и посчитайте строки — будет 8</li><li>Тот же запрос, но условие в <b>WHERE</b> — станет 1</li><li>Объясните себе разницу и проверьте: во втором случае внешнее соединение выродилось во внутреннее</li><li>Найдите заказы с их позициями и убедитесь, что число строк больше числа заказов</li></ul>",
  hint:"В первом случае остаются все клиенты, просто у большинства правая половина пустая. Во втором строки с NULL отсеиваются условием.",
  checks:[
   {label:"Условие в <code>ON</code> — 8 строк", test:st=>st.log.some(e=>!e.err&&/on[\s\S]*and[\s\S]*отмен/i.test(e.sql)&&e.res&&(e.res.rows.length===8||(e.res.rows.length===1&&e.res.rows[0][0]===8)))},
   {label:"Условие в <code>WHERE</code> — 1 строка", test:st=>st.log.some(e=>!e.err&&/left\s+join[\s\S]*where[\s\S]*отмен/i.test(e.sql)&&e.res&&(e.res.rows.length===1))},
   {label:"Соединены заказы с позициями", test:st=>ran(st,/order_items/i)&&answer(st,rows=>rows.length===20||(rows.length===1&&rows[0][0]===20))},
   {label:"Видно, что строк стало больше, чем заказов", test:st=>{
     const vals = st.log.filter(e=>e.res&&e.res.kind==="rows").map(e=>e.res.rows.length);
     return vals.includes(20)||st.log.some(e=>e.res&&e.res.rows.length===1&&e.res.rows[0][0]===20);}}
  ]}
]
},
