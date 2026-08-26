/* ------------------------------------------------ 7 */
{
n:7, id:"sub", title:"Подзапросы", sub:"Запрос внутри запроса",
lede:"Скалярные, списочные и коррелированные подзапросы; EXISTS против IN; где подзапрос уместен, а где лучше соединение.",
theory:`
<p>Подзапрос — это <code>SELECT</code> внутри другого запроса. Три роли, в которых он встречается, различаются формой результата.</p>

<h2>1. Скалярный: одна строка, один столбец</h2>
<pre><code><span class="k">SELECT</span> title, price,
       price - (<span class="k">SELECT</span> round(avg(price)) <span class="k">FROM</span> products) <span class="k">AS</span> отклонение
<span class="k">FROM</span> products;</code></pre>
<p>Такой подзапрос стоит там, где ожидается значение. Если он вернёт больше одной строки — ошибка выполнения; если ни одной — NULL.</p>

<h2>2. Списочный: используется с IN, ANY, ALL</h2>
<pre><code><span class="k">SELECT</span> * <span class="k">FROM</span> customers
<span class="k">WHERE</span> id <span class="k">IN</span> (<span class="k">SELECT</span> customer_id <span class="k">FROM</span> orders <span class="k">WHERE</span> status = 'доставлен');

<span class="k">SELECT</span> * <span class="k">FROM</span> products
<span class="k">WHERE</span> price &gt; <span class="k">ALL</span> (<span class="k">SELECT</span> price <span class="k">FROM</span> products <span class="k">WHERE</span> category = 'периферия');</code></pre>
<p><code>&gt; ANY</code> означает «больше хотя бы одного», <code>&gt; ALL</code> — «больше каждого». Форма редкая, но иногда точно выражает мысль.</p>

<h2>3. Коррелированный: ссылается на внешний запрос</h2>
<pre><code><span class="k">SELECT</span> c.name,
       (<span class="k">SELECT</span> count(*) <span class="k">FROM</span> orders o <span class="k">WHERE</span> o.customer_id = c.id) <span class="k">AS</span> заказов
<span class="k">FROM</span> customers c;</code></pre>
<p>Здесь внутренний запрос упоминает <code>c.id</code> — псевдоним из внешнего. Концептуально он выполняется для каждой строки внешнего запроса; на практике планировщик обычно переписывает такую конструкцию в соединение.</p>

<h2>EXISTS</h2>
<pre><code><span class="k">SELECT</span> c.name <span class="k">FROM</span> customers c
<span class="k">WHERE EXISTS</span> (<span class="k">SELECT</span> 1 <span class="k">FROM</span> orders o <span class="k">WHERE</span> o.customer_id = c.id);</code></pre>
<div class="note ok"><b class="hd">Что внутри EXISTS — не важно</b><p>Проверяется только, вернул ли подзапрос хоть одну строку. Поэтому пишут <code>SELECT 1</code>: значение всё равно не используется. И поэтому <code>EXISTS</code> может остановиться на первом же совпадении, тогда как <code>IN</code> в общем случае должен собрать весь список.</p></div>

<h2>IN, EXISTS, JOIN — что выбрать</h2>
<div class="tw"><table>
<tr><th>Задача</th><th>Лучший инструмент</th><th>Почему</th></tr>
<tr><td>«есть ли хоть один связанный»</td><td><code>EXISTS</code></td><td>не размножает строки, останавливается на первом</td></tr>
<tr><td>«нет ни одного связанного»</td><td><code>NOT EXISTS</code></td><td>единственная форма, устойчивая к NULL</td></tr>
<tr><td>нужны столбцы связанной таблицы</td><td><code>JOIN</code></td><td>подзапрос их не отдаёт</td></tr>
<tr><td>короткий явный список</td><td><code>IN (…)</code></td><td>читается лучше всего</td></tr>
</table></div>
<div class="note trap"><b class="hd">NOT IN и NULL — повторно</b><p>Это настолько частая ошибка, что стоит повторить: если подзапрос внутри <code>NOT IN</code> может вернуть NULL, результат будет пуст всегда. <code>NOT EXISTS</code> такой проблемы не имеет, потому что проверяет наличие строк, а не равенство значений.</p></div>

<h2>Подзапрос вместо таблицы</h2>
<pre><code><span class="k">SELECT</span> category, шт <span class="k">FROM</span> (
  <span class="k">SELECT</span> category, count(*) <span class="k">AS</span> шт <span class="k">FROM</span> products <span class="k">GROUP BY</span> category
) t
<span class="k">WHERE</span> шт &gt;= 3;</code></pre>
<p>Подзапрос в <code>FROM</code> обязан иметь псевдоним. Такая форма нужна, когда результат агрегации требуется отфильтровать или соединить дальше. Для читаемости то же самое обычно выносят в CTE — об этом следующий модуль.</p>
`,
quiz:[
 {q:"Что вернёт скалярный подзапрос, не нашедший ни одной строки?",
  opts:["0","NULL","Ошибку","Пустую строку"],
  a:1, why:"Значения нет — значит NULL. Ошибку он выдаст в противоположном случае: если строк окажется больше одной."},
 {q:"Почему внутри <code>EXISTS</code> обычно пишут <code>SELECT 1</code>?",
  opts:["Так быстрее выполняется","Значение не используется — проверяется только наличие строк","Это требование стандарта","Чтобы не было конфликта имён"],
  a:1, why:"Список выборки внутри EXISTS игнорируется. Единица — просто соглашение, подчёркивающее, что данные не нужны."},
 {q:"Какая форма надёжна при поиске «тех, у кого нет связанных строк»?",
  opts:["<code>NOT IN</code> с подзапросом","<code>NOT EXISTS</code>","<code>&lt;&gt; ALL</code>","<code>INNER JOIN</code>"],
  a:1, why:"NOT EXISTS не зависит от того, встречается ли NULL в проверяемом столбце, — он смотрит на наличие строк, а не сравнивает значения."},
 {q:"Что делает <code>price &gt; ALL (SELECT price FROM products WHERE category = 'периферия')</code>?",
  opts:["Больше хотя бы одного","Больше каждого из них","Больше среднего","Больше суммы"],
  a:1, why:"ALL требует истинности для всех элементов, ANY — хотя бы для одного. Эквивалент через агрегат: <code>&gt; (SELECT max(price) …)</code>."},
 {q:"Что обязательно для подзапроса в <code>FROM</code>?",
  opts:["Условие WHERE","Псевдоним","Агрегат","ORDER BY"],
  a:1, why:"Без имени к его столбцам нельзя обратиться, и PostgreSQL отвергнет такой запрос."},
 {q:"Когда подзапрос нельзя заменить на JOIN?",
  opts:["Никогда","Когда нужен ровно один результат в списке выборки, а соединение размножило бы строки","Когда используется GROUP BY","Когда таблиц больше двух"],
  a:1, why:"Скалярный коррелированный подзапрос даёт одно значение на строку. Соединение с таблицей, где несколько совпадений, дало бы несколько строк."}
],
labs:[
 {id:"7a", title:"Три вида подзапросов",
  brief:"<h3>Три вида подзапросов</h3><ul><li>Товары дороже средней цены (должно быть 3)</li><li>Для каждого товара выведите его цену и отклонение от средней</li><li>Клиенты, у которых есть хотя бы один заказ — через <code>IN</code> (6 строк)</li><li>То же через <code>EXISTS</code> — результат должен совпасть</li><li>Для каждого клиента выведите имя и число его заказов коррелированным подзапросом (8 строк)</li></ul>",
  hint:"Средняя цена: (SELECT avg(price) FROM products). Коррелированный подзапрос ссылается на псевдоним внешней таблицы.",
  checks:[
   {label:"Товары дороже средней цены", test:st=>answer(st,rows=>rows.length===3)&&ran(st,/avg\s*\(\s*price/i)},
   {label:"Показано отклонение от средней", test:st=>answer(st,(rows,cols)=>rows.length===10&&cols.length>=3)},
   {label:"Клиенты с заказами через <code>IN</code>", test:st=>ran(st,/\bin\s*\(\s*select/i)&&answer(st,rows=>rows.length===6)},
   {label:"То же через <code>EXISTS</code>", test:st=>st.log.some(e=>!e.err&&/\bexists\s*\(/i.test(e.sql)&&e.res&&e.res.rows.length===6)},
   {label:"Коррелированный подсчёт заказов", test:st=>st.log.some(e=>!e.err&&/select[\s\S]*\(\s*select\s+count[\s\S]*where[\s\S]*\.\s*id/i.test(e.sql)&&e.res&&e.res.rows.length===8)}
  ]},
 {id:"7b", title:"Выбрать инструмент",
  brief:"<h3>Выбрать инструмент</h3><ul><li>Клиенты <b>без</b> заказов через <code>NOT EXISTS</code> — 2 строки</li><li>Товары дороже <b>всей</b> периферии — через <code>&gt; ALL</code> и через <code>&gt; (SELECT max(...))</code>; в обоих случаях 5 строк</li><li>Категории, где больше двух товаров — подзапросом в <code>FROM</code> с последующим <code>WHERE</code></li><li>Самый дорогой товар в каждой категории: соедините products с подзапросом, считающим max(price) по категории</li></ul>",
  hint:"Подзапрос в FROM обязан получить псевдоним. Для «максимум по категории» удобно соединять по двум условиям: категории и цене.",
  checks:[
   {label:"<code>NOT EXISTS</code> нашёл двоих", test:st=>ran(st,/not\s+exists/i)&&answer(st,rows=>rows.length===2)},
   {label:"Использован <code>&gt; ALL</code>", test:st=>st.log.some(e=>!e.err&&/>\s*all\s*\(/i.test(e.sql))},
   {label:"Тот же ответ через <code>max</code>", test:st=>{
     const a = st.log.find(e=>!e.err&&/>\s*all\s*\(/i.test(e.sql)&&e.res);
     const b = st.log.find(e=>!e.err&&/>\s*\(\s*select\s+max/i.test(e.sql)&&e.res);
     return a&&b&&a.res.rows.length===b.res.rows.length&&a.res.rows.length>0;}},
   {label:"Подзапрос в <code>FROM</code> с фильтром", test:st=>st.log.some(e=>!e.err&&/from\s*\(\s*select[\s\S]*group\s+by[\s\S]*\)\s*\w/i.test(e.sql))},
   {label:"Найден максимум по каждой категории (4 строки)", test:st=>answer(st,rows=>rows.length===4)&&ran(st,/max\s*\(\s*price/i)}
  ]}
]
},

/* ------------------------------------------------ 8 */
{
n:8, id:"cte", title:"CTE и множества", sub:"WITH, рекурсия, UNION",
lede:"Как разложить сложный запрос на именованные шаги, обойти дерево рекурсивным CTE и сложить результаты операциями над множествами.",
theory:`
<h2>WITH — именованный подзапрос</h2>
<pre><code><span class="k">WITH</span> по_категориям <span class="k">AS</span> (
  <span class="k">SELECT</span> category, count(*) <span class="k">AS</span> шт, round(avg(price)) <span class="k">AS</span> средняя
  <span class="k">FROM</span> products <span class="k">GROUP BY</span> category
)
<span class="k">SELECT</span> * <span class="k">FROM</span> по_категориям <span class="k">WHERE</span> шт &gt;= 3 <span class="k">ORDER BY</span> средняя <span class="k">DESC</span>;</code></pre>
<p>То же самое можно написать подзапросом в <code>FROM</code>, но CTE читается сверху вниз как последовательность шагов, а не изнутри наружу. Несколько CTE перечисляются через запятую, и каждый следующий может ссылаться на предыдущие.</p>
<div class="note"><b class="hd">CTE и оптимизация</b><p>До версии 12 PostgreSQL всегда материализовал CTE — вычислял целиком, независимо от того, как результат используется дальше. Это было и барьером для оптимизации, и удобным способом её запретить. Начиная с 12-й версии CTE, использованный однажды и не содержащий изменений данных, встраивается в основной запрос; управлять этим можно явно: <code>AS MATERIALIZED</code> или <code>AS NOT MATERIALIZED</code>.</p></div>

<h2>Рекурсивный CTE</h2>
<pre><code><span class="k">WITH RECURSIVE</span> дерево <span class="k">AS</span> (
  <span class="c">-- якорь: с чего начинаем</span>
  <span class="k">SELECT</span> id, name, manager_id, 1 <span class="k">AS</span> уровень
  <span class="k">FROM</span> employees <span class="k">WHERE</span> manager_id <span class="k">IS NULL</span>

  <span class="k">UNION ALL</span>

  <span class="c">-- шаг: присоединяем подчинённых уже найденных</span>
  <span class="k">SELECT</span> e.id, e.name, e.manager_id, д.уровень + 1
  <span class="k">FROM</span> employees e
  <span class="k">JOIN</span> дерево д <span class="k">ON</span> e.manager_id = д.id
)
<span class="k">SELECT</span> * <span class="k">FROM</span> дерево <span class="k">ORDER BY</span> уровень, id;</code></pre>
<figure class="fig">
<svg viewBox="0 0 620 170" role="img" aria-label="Как работает рекурсивный CTE">
 <g font-family="var(--fm)" font-size="10">
  <rect x="0" y="16" width="150" height="40" rx="3" fill="var(--acc-s)" stroke="var(--acc)"/>
  <text x="75" y="33" text-anchor="middle" fill="var(--ink)">якорь</text>
  <text x="75" y="47" text-anchor="middle" font-size="9" fill="var(--ink3)">уровень 1: директор</text>
  <path d="M154 36h34" stroke="var(--acc)" stroke-width="1.3"/><path d="M188 36l-8-4.5v9z" fill="var(--acc)"/>
  <rect x="192" y="16" width="150" height="40" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="267" y="33" text-anchor="middle" fill="var(--ink)">шаг 1</text>
  <text x="267" y="47" text-anchor="middle" font-size="9" fill="var(--ink3)">подчинённые директора</text>
  <path d="M346 36h34" stroke="var(--acc)" stroke-width="1.3"/><path d="M380 36l-8-4.5v9z" fill="var(--acc)"/>
  <rect x="384" y="16" width="150" height="40" rx="3" fill="var(--surf3)" stroke="var(--line)"/>
  <text x="459" y="33" text-anchor="middle" fill="var(--ink)">шаг 2</text>
  <text x="459" y="47" text-anchor="middle" font-size="9" fill="var(--ink3)">их подчинённые</text>
  <path d="M538 36h34" stroke="var(--line)" stroke-width="1.3" stroke-dasharray="3 3"/>
  <text x="592" y="40" text-anchor="middle" font-size="9" fill="var(--ink3)">…</text>
  <text x="0" y="82" font-size="9.5" fill="var(--ink2)">Каждый шаг работает только с результатом ПРЕДЫДУЩЕГО шага, а не со всем накопленным.</text>
  <text x="0" y="98" font-size="9.5" fill="var(--ink2)">Как только очередной шаг вернул ноль строк — обход закончен.</text>
  <rect x="0" y="112" width="620" height="46" rx="3" fill="var(--warn-s)" stroke="var(--warn)"/>
  <text x="12" y="130" font-size="9.5" fill="var(--ink)">UNION ALL не проверяет дубликаты — при цикле в данных запрос будет работать вечно.</text>
  <text x="12" y="146" font-size="9.5" fill="var(--ink)">Страховки: UNION вместо UNION ALL, счётчик уровня с ограничением, или накопление пути в массиве.</text>
 </g>
</svg>
<figcaption>Рекурсия в SQL — это цикл: якорь задаёт начало, шаг повторяется, пока приносит новые строки.</figcaption>
</figure>

<h2>Операции над множествами</h2>
<div class="tw"><table>
<tr><th>Операция</th><th>Смысл</th><th>Дубликаты</th></tr>
<tr><td><code>UNION</code></td><td>строки обоих запросов</td><td>убирает</td></tr>
<tr><td><code>UNION ALL</code></td><td>то же</td><td>оставляет — и потому заметно быстрее</td></tr>
<tr><td><code>INTERSECT</code></td><td>строки, встречающиеся в обоих</td><td>убирает</td></tr>
<tr><td><code>EXCEPT</code></td><td>строки первого, которых нет во втором</td><td>убирает</td></tr>
</table></div>
<div class="note warn"><b class="hd">Требования к операндам</b><p>Число столбцов должно совпадать, а типы — быть совместимыми. Имена берутся из первого запроса. <code>ORDER BY</code> относится ко всему результату и пишется один раз в конце.</p><p>Выбирайте <code>UNION ALL</code>, если дубликаты невозможны или не мешают: обычный <code>UNION</code> вынужден отсортировать или захешировать весь результат ради их устранения.</p></div>
`,
quiz:[
 {q:"Что даёт CTE по сравнению с подзапросом в FROM?",
  opts:["Всегда более быстрый план","Читаемость: запрос раскладывается на именованные шаги сверху вниз","Возможность использовать агрегаты","Автоматическое кеширование навсегда"],
  a:1, why:"Выигрыш прежде всего в структуре. С версии 12 одноразовый CTE ещё и встраивается в запрос, так что разницы в плане обычно нет."},
 {q:"Из чего состоит рекурсивный CTE?",
  opts:["Из условия выхода и тела цикла","Из якорной части и рекурсивной, соединённых UNION","Из трёх обязательных подзапросов","Из WITH и HAVING"],
  a:1, why:"Якорь даёт стартовые строки, рекурсивная часть присоединяет следующий уровень. Остановка происходит, когда шаг перестаёт возвращать строки."},
 {q:"Чем опасен <code>UNION ALL</code> в рекурсивном CTE при цикле в данных?",
  opts:["Ничем","Запрос не остановится: дубликаты не отсекаются","Вернёт ошибку типов","Потеряет строки"],
  a:1, why:"Обычный UNION устраняет повторы и потому естественно завершается на цикле. Иначе нужен явный ограничитель глубины."},
 {q:"Чем <code>UNION</code> отличается от <code>UNION ALL</code>?",
  opts:["Ничем","UNION убирает дубликаты и потому дороже","UNION работает только с двумя запросами","UNION ALL сортирует результат"],
  a:1, why:"Устранение дубликатов требует сортировки или хеширования всего объединённого набора. Если повторов быть не может, ALL — правильный выбор."},
 {q:"Откуда берутся имена столбцов в результате <code>UNION</code>?",
  opts:["Из второго запроса","Из первого запроса","Генерируются автоматически","Требуется явный AS"],
  a:1, why:"Поэтому именно первому запросу задают понятные псевдонимы; в остальных они ни на что не влияют."},
 {q:"Что вернёт <code>EXCEPT</code>?",
  opts:["Общие строки","Строки первого запроса, отсутствующие во втором","Все строки обоих","Строки второго, отсутствующие в первом"],
  a:1, why:"Операция несимметрична — порядок запросов имеет значение. Для пересечения используется INTERSECT."}
],
labs:[
 {id:"8a", title:"Разложить на шаги",
  brief:"<h3>Разложить на шаги</h3><ul><li>CTE со статистикой по категориям (количество и средняя цена), из него выберите категории с тремя и более товарами</li><li>Два CTE подряд: первый считает заказы по клиентам, второй берёт из первого только тех, у кого больше одного заказа</li><li>Постройте дерево подчинённости рекурсивным CTE — 9 строк с уровнем от 1 до 3</li><li>Найдите всех подчинённых сотрудника с id = 2, включая косвенных (их двое)</li></ul>",
  hint:"WITH RECURSIVE t AS (якорь UNION ALL шаг) SELECT * FROM t. Якорь для второй задачи — WHERE id = 2 или WHERE manager_id = 2.",
  checks:[
   {label:"Использован <code>WITH</code>", test:st=>ran(st,/\bwith\b/i)&&st.log.some(e=>!e.err&&/\bwith\b/i.test(e.sql))},
   {label:"Из CTE отобраны категории", test:st=>st.log.some(e=>!e.err&&/\bwith\b/i.test(e.sql)&&e.res&&e.res.rows.length>0&&e.res.rows.length<4)},
   {label:"Два CTE в одном запросе", test:st=>st.log.some(e=>!e.err&&/with[\s\S]*\)\s*,\s*[^\s,()]+\s+as\s*\(/i.test(e.sql))},
   {label:"Построено дерево — 9 строк", test:st=>ran(st,/with\s+recursive/i)&&answer(st,rows=>rows.length===9)},
   {label:"Найдены подчинённые сотрудника 2", test:st=>st.log.some(e=>!e.err&&/with\s+recursive/i.test(e.sql)&&e.res&&e.res.rows.length>=2&&e.res.rows.length<=4)}
  ]},
 {id:"8b", title:"Операции над множествами",
  brief:"<h3>Операции над множествами</h3><ul><li>Объедините города клиентов и категории товаров через <code>UNION</code> — получится общий список значений</li><li>Найдите id клиентов, у которых есть заказы, через <code>INTERSECT</code>: id из customers пересечь с customer_id из orders (6 строк)</li><li>Найдите клиентов без заказов через <code>EXCEPT</code> (2 строки)</li><li>Сравните <code>UNION</code> и <code>UNION ALL</code> на статусах заказов: разное число строк</li></ul>",
  hint:"Число столбцов у операндов должно совпадать. Для сравнения UNION и UNION ALL возьмите SELECT status FROM orders дважды.",
  checks:[
   {label:"Выполнен <code>UNION</code>", test:st=>st.log.some(e=>!e.err&&/\bunion\b/i.test(e.sql))},
   {label:"<code>INTERSECT</code> дал 6 строк", test:st=>ran(st,/intersect/i)&&answer(st,rows=>rows.length===6)},
   {label:"<code>EXCEPT</code> дал 2 строки", test:st=>ran(st,/except/i)&&answer(st,rows=>rows.length===2)},
   {label:"Разница между <code>UNION</code> и <code>UNION ALL</code> видна", test:st=>{
     const a = st.log.find(e=>!e.err&&/union\s+all/i.test(e.sql)&&e.res);
     const b = st.log.find(e=>!e.err&&/union(?!\s+all)/i.test(e.sql)&&e.res);
     return a&&b&&a.res.rows.length>b.res.rows.length;}}
  ]}
]
},

/* ------------------------------------------------ 9 */
{
n:9, id:"win", title:"Оконные функции", sub:"Считать, не сворачивая",
lede:"Агрегат по группе рядом с каждой строкой; нумерация и ранги; накопительные итоги. Самый мощный инструмент аналитического SQL.",
theory:`
<div class="note ok"><b class="hd">Главная идея в одной фразе</b><p><code>GROUP BY</code> схлопывает строки в одну на группу. <b>Оконная функция считает то же самое, но оставляет все строки на месте</b>, добавляя результат отдельным столбцом.</p></div>
<pre><code><span class="k">SELECT</span> title, category, price,
       round(avg(price) <span class="k">OVER</span> (<span class="k">PARTITION BY</span> category)) <span class="k">AS</span> средняя_в_категории
<span class="k">FROM</span> products;</code></pre>
<p>Десять строк на входе — десять на выходе, у каждой рядом среднее по её категории. Через <code>GROUP BY</code> так не сделать: пришлось бы соединять таблицу с агрегатом.</p>

<h2>Синтаксис окна</h2>
<pre><code>функция() <span class="k">OVER</span> (
  <span class="k">PARTITION BY</span> столбец   <span class="c">-- на какие независимые части делим (необязательно)</span>
  <span class="k">ORDER BY</span> столбец       <span class="c">-- порядок внутри части (нужен рангам и накоплению)</span>
)</code></pre>
<p>Без <code>PARTITION BY</code> окно — вся выборка. Без <code>ORDER BY</code> функция видит всю часть целиком; с ним — по умолчанию строки от начала части до текущей, что и даёт накопительный итог.</p>

<h2>Функции нумерации</h2>
<div class="tw"><table>
<tr><th>Функция</th><th>При равных значениях 10, 20, 20, 30 даст</th></tr>
<tr><td><code>row_number()</code></td><td>1, 2, 3, 4 — просто номера, связи разрываются произвольно</td></tr>
<tr><td><code>rank()</code></td><td>1, 2, 2, 4 — равным один ранг, следующий с пропуском</td></tr>
<tr><td><code>dense_rank()</code></td><td>1, 2, 2, 3 — без пропуска</td></tr>
<tr><td><code>lag(col)</code>, <code>lead(col)</code></td><td>значение из предыдущей / следующей строки окна</td></tr>
<tr><td><code>first_value</code>, <code>last_value</code></td><td>первое / последнее значение в рамке окна</td></tr>
</table></div>

<h2>Топ-N в каждой группе</h2>
<p>Классическая задача, у которой нет простого решения без окон.</p>
<pre><code><span class="k">SELECT</span> * <span class="k">FROM</span> (
  <span class="k">SELECT</span> title, category, price,
         row_number() <span class="k">OVER</span> (<span class="k">PARTITION BY</span> category <span class="k">ORDER BY</span> price <span class="k">DESC</span>) <span class="k">AS</span> н
  <span class="k">FROM</span> products
) t
<span class="k">WHERE</span> н &lt;= 2;</code></pre>
<div class="note trap"><b class="hd">Оконную функцию нельзя фильтровать в WHERE</b><p>Окна вычисляются <b>после</b> <code>WHERE</code>, <code>GROUP BY</code> и <code>HAVING</code> — на том же этапе, что и список выборки. Поэтому <code>WHERE row_number() &lt;= 2</code> — ошибка, и результат приходится оборачивать в подзапрос или CTE. Это единственная причина, по которой такие запросы выглядят двухэтажными.</p></div>

<h2>Накопительный итог</h2>
<pre><code><span class="k">SELECT</span> ordered_at, id,
       sum(1) <span class="k">OVER</span> (<span class="k">ORDER BY</span> ordered_at, id) <span class="k">AS</span> заказов_нарастающим
<span class="k">FROM</span> orders;</code></pre>
<p>Появление <code>ORDER BY</code> внутри <code>OVER</code> меняет смысл агрегата: он считается не по всей части, а по строкам от начала до текущей. Без <code>ORDER BY</code> тот же <code>sum</code> дал бы одинаковый итог во всех строках.</p>
`,
quiz:[
 {q:"Чем оконная функция отличается от обычного агрегата?",
  opts:["Работает быстрее","Не схлопывает строки: результат добавляется к каждой строке","Не поддерживает PARTITION BY","Может использоваться только с ORDER BY"],
  a:1, why:"GROUP BY уменьшает число строк, окно — нет. Поэтому окном легко положить показатель группы рядом с каждой её строкой."},
 {q:"Значения 10, 20, 20, 30. Что даст <code>rank()</code>?",
  opts:["1, 2, 3, 4","1, 2, 2, 4","1, 2, 2, 3","1, 1, 2, 3"],
  a:1, why:"Равным значениям присваивается общий ранг, а следующий номер учитывает число пропущенных позиций. Без пропуска считает dense_rank."},
 {q:"Почему <code>WHERE row_number() OVER (…) &lt;= 2</code> — ошибка?",
  opts:["Синтаксис требует скобок","Окна вычисляются после WHERE — на этапе списка выборки","row_number нельзя сравнивать","Нужен HAVING"],
  a:1, why:"На момент WHERE окна ещё не вычислены. Поэтому топ-N в группе всегда оборачивают в подзапрос или CTE."},
 {q:"Что делает <code>ORDER BY</code> внутри <code>OVER (…)</code> для <code>sum</code>?",
  opts:["Только сортирует вывод","Превращает сумму в накопительный итог от начала части до текущей строки","Ничего не меняет","Запрещён для sum"],
  a:1, why:"По умолчанию рамка окна при наличии ORDER BY — от первой строки до текущей. Без ORDER BY агрегат считается по всей части сразу."},
 {q:"Что означает <code>PARTITION BY category</code>?",
  opts:["Сортировку по категории","Деление выборки на независимые части, внутри которых считается функция","Фильтр по категории","Группировку с потерей строк"],
  a:1, why:"Это аналог GROUP BY для окна, но строки остаются. Без PARTITION BY окном становится вся выборка."},
 {q:"Как получить значение из предыдущей строки окна?",
  opts:["<code>prev()</code>","<code>lag()</code>","<code>offset()</code>","<code>row_number() - 1</code>"],
  a:1, why:"Парная ей <code>lead()</code> заглядывает вперёд. Обе принимают необязательное смещение и значение по умолчанию."}
],
labs:[
 {id:"9a", title:"Окно вместо группировки",
  brief:"<h3>Окно вместо группировки</h3><ul><li>Выведите все 10 товаров и рядом среднюю цену их категории</li><li>Пронумеруйте товары по убыванию цены через <code>row_number()</code></li><li>Проставьте сотрудникам ранг по окладу внутри отдела</li><li>Постройте накопительный счётчик заказов по дате</li></ul>",
  hint:"avg(price) OVER (PARTITION BY category). Для ранга внутри отдела — rank() OVER (PARTITION BY dept ORDER BY salary DESC).",
  checks:[
   {label:"Средняя по категории рядом с каждой строкой", test:st=>ran(st,/over\s*\(\s*partition\s+by/i)&&answer(st,rows=>rows.length===10)},
   {label:"Использована <code>row_number()</code>", test:st=>ran(st,/row_number\s*\(\s*\)/i)&&answer(st,rows=>rows.length===10)},
   {label:"Ранг по окладу внутри отдела", test:st=>ran(st,/rank\s*\(\s*\)\s*over/i)&&answer(st,rows=>rows.length===9)},
   {label:"Накопительный итог с <code>ORDER BY</code> в окне", test:st=>st.log.some(e=>!e.err&&/over\s*\([^)]*order\s+by/i.test(e.sql)&&e.res&&e.res.rows.length===12)}
  ]},
 {id:"9b", title:"Топ в каждой группе",
  brief:"<h3>Топ в каждой группе</h3><ul><li>Попробуйте отфильтровать окно прямо в <code>WHERE</code> — получите ошибку</li><li>Оберните запрос в подзапрос или CTE и выведите два самых дорогих товара каждой категории</li><li>Выведите самого высокооплачиваемого сотрудника каждого отдела</li><li>Для каждого товара покажите разницу с ценой предыдущего по возрастанию — через <code>lag()</code></li></ul>",
  hint:"WITH t AS (SELECT ..., row_number() OVER (PARTITION BY ... ORDER BY ...) AS n FROM ...) SELECT * FROM t WHERE n <= 2.",
  checks:[
   {label:"Фильтр окна в <code>WHERE</code> дал ошибку", test:st=>st.log.some(e=>e.err&&/окон/i.test(e.err))},
   {label:"Топ-2 по категориям через обёртку", test:st=>st.log.some(e=>!e.err&&/(with|from\s*\()[\s\S]*over\s*\([\s\S]*partition/i.test(e.sql)&&e.res&&e.res.rows.length===7)},
   {label:"Лучший по окладу в каждом отделе (4 строки)", test:st=>answer(st,rows=>rows.length===4)&&ran(st,/partition\s+by/i)},
   {label:"Использована <code>lag()</code>", test:st=>ran(st,/lag\s*\(/i)&&answer(st,rows=>rows.length===10)}
  ]}
]
},
