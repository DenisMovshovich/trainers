/* ------------------------------------------------ 10 */
{
n:10, id:"dml", title:"Изменение данных", sub:"INSERT, UPDATE, DELETE, транзакции",
lede:"Как добавлять, менять и удалять строки, зачем RETURNING, что делает UPSERT и почему транзакция — это не «на всякий случай».",
theory:`
<h2>INSERT</h2>
<pre><code><span class="k">INSERT INTO</span> customers (name, email, city)
<span class="k">VALUES</span> ('Анна Крылова', 'anna@example.com', 'Казань');

<span class="c">-- несколько строк одним запросом — заметно быстрее, чем много отдельных</span>
<span class="k">INSERT INTO</span> products (title, category, price, stock) <span class="k">VALUES</span>
  ('Коврик', 'аксессуары', 990, 100),
  ('Подставка', 'аксессуары', 2490, 40);</code></pre>
<div class="note ok"><b class="hd">Всегда перечисляйте столбцы</b><p><code>INSERT INTO t VALUES (…)</code> без списка столбцов привязывается к их физическому порядку. Добавили столбец в таблицу — и все такие вставки в коде молча начинают писать значения не туда либо падают. Явный список делает вставку устойчивой к изменениям схемы.</p></div>

<h2>RETURNING</h2>
<pre><code><span class="k">INSERT INTO</span> orders (customer_id, ordered_at, status)
<span class="k">VALUES</span> (1, '2025-08-01', 'оформлен')
<span class="k">RETURNING</span> id;</code></pre>
<p>Расширение PostgreSQL: команда изменения возвращает строки, как <code>SELECT</code>. Так узнают сгенерированный ключ, не делая второй запрос, и так же можно вернуть удалённые или изменённые строки из <code>DELETE</code> и <code>UPDATE</code>.</p>

<h2>UPDATE и DELETE</h2>
<pre><code><span class="k">UPDATE</span> products <span class="k">SET</span> price = price * 1.1 <span class="k">WHERE</span> category = 'аксессуары';
<span class="k">DELETE FROM</span> orders <span class="k">WHERE</span> status = 'отменён';</code></pre>
<div class="note trap"><b class="hd">UPDATE и DELETE без WHERE затрагивают всю таблицу</b><p>Синтаксической ошибки не будет, предупреждения тоже. Практика, спасающая от беды: сначала напишите запрос как <code>SELECT</code> с тем же условием, посмотрите, какие строки попали, и только потом замените начало на <code>UPDATE</code> или <code>DELETE</code>. И выполняйте такое внутри транзакции, чтобы был путь назад.</p></div>

<h2>UPSERT</h2>
<pre><code><span class="k">INSERT INTO</span> customers (name, email, city)
<span class="k">VALUES</span> ('Анна Крылова', 'anna@example.com', 'Уфа')
<span class="k">ON CONFLICT</span> (email) <span class="k">DO UPDATE SET</span> city = excluded.city;</code></pre>
<p>Если строка с таким адресом уже есть, вместо ошибки выполнится обновление. Псевдотаблица <code>excluded</code> содержит значения, которые пытались вставить. Вариант <code>DO NOTHING</code> просто пропускает конфликт.</p>

<h2>Транзакции</h2>
<pre><code><span class="k">BEGIN</span>;
  <span class="k">UPDATE</span> accounts <span class="k">SET</span> balance = balance - 1000 <span class="k">WHERE</span> id = 1;
  <span class="k">UPDATE</span> accounts <span class="k">SET</span> balance = balance + 1000 <span class="k">WHERE</span> id = 2;
<span class="k">COMMIT</span>;   <span class="c">-- или ROLLBACK, чтобы отменить обе</span></code></pre>
<figure class="fig">
<svg viewBox="0 0 620 172" role="img" aria-label="Свойства транзакции ACID">
 <g font-family="var(--fm)" font-size="10">
  ${[["A","Атомарность","либо все изменения, либо ни одного"],
     ["C","Согласованность","ограничения целостности не нарушаются"],
     ["I","Изолированность","параллельные транзакции не видят промежуточных состояний"],
     ["D","Долговечность","после COMMIT данные переживут отключение питания"]].map((r,i)=>{
    const y = 10 + i*34;
    return '<rect x="0" y="'+y+'" width="30" height="28" rx="3" fill="var(--acc)"/>'+
      '<text x="15" y="'+(y+19)+'" text-anchor="middle" font-weight="700" fill="#fff" font-size="12">'+r[0]+'</text>'+
      '<text x="42" y="'+(y+13)+'" fill="var(--ink)" font-size="10.5">'+r[1]+'</text>'+
      '<text x="42" y="'+(y+25)+'" fill="var(--ink3)" font-size="9.5">'+r[2]+'</text>';
  }).join("")}
  <text x="0" y="156" font-size="9.5" fill="var(--ink3)">В PostgreSQL любая одиночная команда уже выполняется в собственной транзакции.</text>
  <text x="0" y="168" font-size="9.5" fill="var(--ink3)">Явный BEGIN нужен только для того, чтобы объединить в одну транзакцию несколько команд.</text>
 </g>
</svg>
<figcaption>Транзакция нужна не «на всякий случай», а всюду, где два изменения обязаны произойти вместе.</figcaption>
</figure>
<div class="note warn"><b class="hd">Ошибка внутри транзакции переводит её в нерабочее состояние</b><p>В PostgreSQL после ошибки все последующие команды до конца транзакции отвергаются с сообщением «текущая транзакция прервана». Единственный выход — <code>ROLLBACK</code> либо откат к точке сохранения (<code>SAVEPOINT</code>). Это отличается от поведения некоторых других СУБД, где после ошибки можно продолжать.</p></div>
`,
quiz:[
 {q:"Почему в коде приложения вредно писать <code>INSERT INTO t VALUES (…)</code> без списка столбцов?",
  opts:["Это медленнее","Вставка привязана к физическому порядку столбцов и ломается при изменении схемы","Не работает с несколькими строками","Не поддерживается PostgreSQL"],
  a:1, why:"Явный список столбцов делает намерение однозначным и переживает добавление или перестановку полей."},
 {q:"Что делает <code>RETURNING id</code> в INSERT?",
  opts:["Проверяет уникальность","Возвращает значения из вставленных строк — например, сгенерированный ключ","Откатывает вставку при ошибке","Ничего, это комментарий"],
  a:1, why:"Экономит второй запрос и работает атомарно со вставкой. Доступно также в UPDATE и DELETE."},
 {q:"Что произойдёт при <code>UPDATE products SET price = 0;</code> без WHERE?",
  opts:["Ошибка синтаксиса","Обновятся все строки таблицы","Обновится первая строка","Потребуется подтверждение"],
  a:1, why:"База выполнит ровно то, что написано. Привычка сначала проверить условие через SELECT и работать внутри транзакции — единственная реальная защита."},
 {q:"Что содержит псевдотаблица <code>excluded</code> в <code>ON CONFLICT DO UPDATE</code>?",
  opts:["Строки, отклонённые ограничением CHECK","Значения, которые пытались вставить","Прежнее состояние строки","Список конфликтующих индексов"],
  a:1, why:"Через неё в обновлении используют новые значения: <code>SET city = excluded.city</code>. Старые доступны по имени таблицы."},
 {q:"Что означает «атомарность» транзакции?",
  opts:["Изменения выполняются по одному","Применяются либо все изменения, либо ни одного","Транзакция не видна другим","Данные пишутся на диск"],
  a:1, why:"Остальные три буквы ACID — согласованность, изолированность и долговечность — отвечают за другие гарантии."},
 {q:"Что происходит после ошибки внутри транзакции в PostgreSQL?",
  opts:["Ошибочная команда пропускается, работа продолжается","Транзакция переходит в нерабочее состояние — нужен ROLLBACK или откат к SAVEPOINT","Транзакция фиксируется автоматически","Соединение разрывается"],
  a:1, why:"Все последующие команды отвергаются до завершения транзакции. Точки сохранения позволяют откатиться частично, не теряя всю работу."}
],
labs:[
 {id:"10a", title:"Добавить, изменить, удалить",
  brief:"<h3>Добавить, изменить, удалить</h3><p>Изменения касаются только вашей учебной копии базы — кнопка «Сбросить базу» вернёт всё как было.</p><ul><li>Добавьте клиента с явным списком столбцов и получите его id через <code>RETURNING</code></li><li>Вставьте два товара категории «аксессуары» одним запросом</li><li>Поднимите цену всех аксессуаров на 10% и убедитесь через <code>RETURNING</code>, что изменилось ровно 2 строки</li><li>Удалите отменённый заказ: сначала его позиции из <code>order_items</code>, затем сам заказ — иначе внешний ключ не даст</li><li>Попробуйте вставить клиента с уже существующим email — получите ошибку уникальности</li></ul>",
  hint:"RETURNING работает во всех трёх командах. Уникальный адрес есть у каждого из восьми клиентов — возьмите любой.",
  checks:[
   {label:"Клиент добавлен с <code>RETURNING</code>", test:st=>ran(st,/insert\s+into\s+customers[\s\S]*returning/i)&&tbl(st,"customers").rows.length>=9},
   {label:"Два товара вставлены одним запросом", test:st=>st.log.some(e=>!e.err&&/insert\s+into\s+products[\s\S]*\)\s*,\s*\(/i.test(e.sql))},
   {label:"Цены аксессуаров подняты", test:st=>st.log.some(e=>!e.err&&/update\s+products[\s\S]*аксессуар/i.test(e.sql))},
   {label:"Отменённые заказы удалены", test:st=>ran(st,/delete\s+from\s+orders/i)&&!tbl(st,"orders").rows.some(r=>r[3]==="отменён")},
   {label:"Дубликат email отклонён", test:st=>st.log.some(e=>e.err&&/уникальн/i.test(e.err))}
  ]},
 {id:"10b", title:"Транзакции и UPSERT",
  brief:"<h3>Транзакции и UPSERT</h3><ul><li>Откройте <code>BEGIN</code>, удалите всех клиентов, посмотрите <code>count(*)</code> — ноль, затем <code>ROLLBACK</code> и снова посчитайте: восемь</li><li>Откройте транзакцию, обновите статус заказа 1 и зафиксируйте через <code>COMMIT</code> — изменение осталось</li><li>Выполните <code>INSERT … ON CONFLICT (email) DO NOTHING</code> с существующим адресом — ошибки не будет, строка не добавится</li><li>Теперь <code>ON CONFLICT (email) DO UPDATE SET city = excluded.city</code> — город обновится</li></ul>",
  hint:"Внутри транзакции результаты видны сразу; ROLLBACK возвращает состояние на момент BEGIN.",
  checks:[
   {label:"Транзакция откачена, данные вернулись", test:st=>ran(st,/rollback/i)&&tbl(st,"customers").rows.length>=8},
   {label:"Во время транзакции было видно удаление", test:st=>st.log.some(e=>e.res&&e.res.kind==="rows"&&e.res.rows.length===1&&e.res.rows[0][0]===0&&/customers/i.test(e.sql))},
   {label:"Транзакция зафиксирована через <code>COMMIT</code>", test:st=>ran(st,/commit/i)&&st.log.some(e=>!e.err&&/update\s+orders/i.test(e.sql))},
   {label:"<code>DO NOTHING</code> отработал без ошибки", test:st=>st.log.some(e=>!e.err&&/on\s+conflict[\s\S]*do\s+nothing/i.test(e.sql))},
   {label:"<code>DO UPDATE</code> обновил город", test:st=>st.log.some(e=>!e.err&&/on\s+conflict[\s\S]*do\s+update/i.test(e.sql))}
  ]}
]
},

/* ------------------------------------------------ 11 */
{
n:11, id:"ddl", title:"Схема и ограничения", sub:"Типы, ключи, целостность",
lede:"Как описать таблицу так, чтобы неверные данные в неё просто не попали. Ограничение в базе надёжнее любой проверки в приложении.",
theory:`
<h2>Основные типы PostgreSQL</h2>
<div class="tw"><table>
<tr><th>Тип</th><th>Для чего</th><th>Замечание</th></tr>
<tr><td><code>integer</code>, <code>bigint</code></td><td>целые числа</td><td>для счётчиков берут bigint: 2 миллиарда кончаются быстрее, чем кажется</td></tr>
<tr><td><code>numeric(p, s)</code></td><td>деньги, точные дроби</td><td>точный десятичный; <b>не</b> используйте float для денег</td></tr>
<tr><td><code>text</code>, <code>varchar(n)</code></td><td>строки</td><td>в PostgreSQL text не медленнее; ограничение длины — вопрос смысла, не скорости</td></tr>
<tr><td><code>boolean</code></td><td>истина/ложь</td><td>умеет ещё и NULL — то есть «неизвестно»</td></tr>
<tr><td><code>date</code>, <code>timestamptz</code></td><td>даты и моменты времени</td><td>для событий берут timestamptz — с часовым поясом</td></tr>
<tr><td><code>jsonb</code></td><td>документы</td><td>двоичный, индексируемый; jsonb, а не json</td></tr>
<tr><td><code>uuid</code></td><td>идентификаторы</td><td>16 байт против 36 в виде строки</td></tr>
</table></div>
<div class="note warn"><b class="hd">Деньги и float</b><p><code>0.1 + 0.2</code> в двоичной плавающей точке не равно <code>0.3</code>. Для сумм это означает копеечные расхождения, которые накапливаются и не сходятся в отчётах. Правильные варианты — <code>numeric</code> либо целое число копеек.</p></div>

<h2>Ограничения</h2>
<pre><code><span class="k">CREATE TABLE</span> reviews (
  id        integer <span class="k">PRIMARY KEY</span>,
  product_id integer <span class="k">NOT NULL REFERENCES</span> products(id),
  author    text <span class="k">NOT NULL</span>,
  rating    integer <span class="k">NOT NULL CHECK</span> (rating <span class="k">BETWEEN</span> 1 <span class="k">AND</span> 5),
  created_at date <span class="k">NOT NULL DEFAULT</span> current_date,
  <span class="k">UNIQUE</span> (product_id, author)
);</code></pre>
<div class="tw"><table>
<tr><th>Ограничение</th><th>Что гарантирует</th></tr>
<tr><td><code>PRIMARY KEY</code></td><td>уникальность и непустоту: строку всегда можно однозначно назвать</td></tr>
<tr><td><code>NOT NULL</code></td><td>значение обязательно</td></tr>
<tr><td><code>UNIQUE</code></td><td>нет повторов; может охватывать несколько столбцов</td></tr>
<tr><td><code>REFERENCES</code></td><td>внешний ключ: ссылка ведёт на существующую строку</td></tr>
<tr><td><code>CHECK</code></td><td>произвольное условие на строку</td></tr>
<tr><td><code>DEFAULT</code></td><td>значение, подставляемое при отсутствии в INSERT</td></tr>
</table></div>
<div class="note ok"><b class="hd">Почему проверка в приложении не заменяет ограничение</b><p>К базе обращается не только ваш код: миграции, ручные правки в консоли, второй сервис, скрипт восстановления. Ограничение действует для всех и всегда, а проверка в приложении — только для тех, кто через него прошёл. Данные живут дольше кода.</p></div>

<h2>Поведение внешнего ключа при удалении</h2>
<div class="tw"><table>
<tr><th>Указание</th><th>Что произойдёт при удалении родителя</th></tr>
<tr><td><code>ON DELETE RESTRICT</code></td><td>удаление запрещено, пока есть потомки (умолчание — NO ACTION, ведёт себя похоже)</td></tr>
<tr><td><code>ON DELETE CASCADE</code></td><td>потомки удаляются вместе — удобно и опасно</td></tr>
<tr><td><code>ON DELETE SET NULL</code></td><td>ссылка обнуляется; столбец должен допускать NULL</td></tr>
</table></div>

<h2>Ключи, генерируемые базой</h2>
<pre><code>id integer <span class="k">GENERATED ALWAYS AS IDENTITY PRIMARY KEY</span>   <span class="c">-- современный стандартный способ</span>
id serial <span class="k">PRIMARY KEY</span>                                <span class="c">-- старый, работает, но считается устаревшим</span></code></pre>

<h2>Нормализация в двух словах</h2>
<p>Каждый факт хранится в одном месте. Город клиента — в <code>customers</code>, а не в каждом его заказе; иначе при переезде придётся править сотни строк, и часть из них останется старой. Обратный приём — сознательная денормализация ради скорости чтения — применяется, когда измерено, что это действительно нужно, и есть план поддерживать копии в согласованном состоянии.</p>
`,
quiz:[
 {q:"Какой тип выбрать для денежных сумм?",
  opts:["<code>float</code> или <code>double precision</code>","<code>numeric</code> либо целое число копеек","<code>text</code>","<code>real</code>"],
  a:1, why:"Двоичная плавающая точка не представляет десятичные дроби точно, и копеечные ошибки накапливаются. numeric — точный десятичный тип."},
 {q:"Что гарантирует <code>PRIMARY KEY</code>?",
  opts:["Только уникальность","Уникальность и непустоту","Только непустоту","Порядок хранения строк"],
  a:1, why:"Это UNIQUE плюс NOT NULL. Кроме того, первичный ключ — цель, на которую ссылаются внешние ключи."},
 {q:"Почему проверка данных в приложении не заменяет <code>CHECK</code> в базе?",
  opts:["Приложение работает медленнее","К базе обращается не только ваш код: миграции, консоль, другие сервисы","CHECK умеет больше условий","Так требует стандарт"],
  a:1, why:"Ограничение действует для всех путей записи и всегда. Данные переживают приложения, которые их создали."},
 {q:"Что делает <code>ON DELETE CASCADE</code>?",
  opts:["Запрещает удаление родителя","Удаляет связанные строки вместе с родителем","Обнуляет ссылку","Откладывает проверку до COMMIT"],
  a:1, why:"Удобно для действительно подчинённых данных (позиции заказа), но одна команда может тихо удалить куда больше, чем ожидалось."},
 {q:"Сколько строк с NULL пропустит <code>UNIQUE (product_id, author)</code>?",
  opts:["Одну","Сколько угодно, если хотя бы один столбец пары NULL","Ни одной","Ровно две"],
  a:1, why:"Ограничение уникальности не сравнивает NULL между собой. Если пара обязана быть заполнена, добавляйте NOT NULL."},
 {q:"Какой способ генерации ключа считается современным в PostgreSQL?",
  opts:["<code>serial</code>","<code>GENERATED ALWAYS AS IDENTITY</code>","Триггер с последовательностью","Вручную из приложения"],
  a:1, why:"IDENTITY — часть стандарта SQL и не порождает отдельного объекта-последовательности с самостоятельными правами, как serial."}
],
labs:[
 {id:"11a", title:"Создать таблицу",
  brief:"<h3>Создать таблицу</h3><ul><li>Создайте таблицу <code>reviews</code>: <code>id</code> — первичный ключ, <code>product_id</code> — обязательная ссылка на <code>products(id)</code>, <code>author</code> — обязательный текст, <code>rating</code> — целое с проверкой <code>BETWEEN 1 AND 5</code></li><li>Вставьте корректный отзыв</li><li>Попробуйте вставить рейтинг 7 — ограничение <code>CHECK</code> отклонит</li><li>Попробуйте сослаться на несуществующий товар с id = 999 — внешний ключ отклонит</li><li>Попробуйте вставить строку без автора — <code>NOT NULL</code> отклонит</li></ul>",
  hint:"CREATE TABLE reviews (id integer PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id), author text NOT NULL, rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5));",
  checks:[
   {label:"Таблица <code>reviews</code> создана", test:st=>!!tbl(st,"reviews")},
   {label:"Корректный отзыв вставлен", test:st=>!!tbl(st,"reviews")&&tbl(st,"reviews").rows.length>=1},
   {label:"<code>CHECK</code> отклонил рейтинг вне диапазона", test:st=>st.log.some(e=>e.err&&/check|проверк/i.test(e.err))},
   {label:"Внешний ключ отклонил ссылку в пустоту", test:st=>st.log.some(e=>e.err&&/внешн/i.test(e.err))},
   {label:"<code>NOT NULL</code> отклонил пропуск автора", test:st=>st.log.some(e=>e.err&&/null/i.test(e.err)&&/author|автор/i.test(e.err+e.sql))}
  ]},
 {id:"11b", title:"Целостность в действии",
  brief:"<h3>Целостность в действии</h3><ul><li>Попробуйте удалить клиента с id = 1 — внешний ключ из <code>orders</code> не даст</li><li>Убедитесь, что мешает: посчитайте его заказы</li><li>Удалите сначала позиции и заказы этого клиента, затем самого клиента — теперь получится</li><li>Попробуйте вставить товар с ценой 0 — сработает <code>CHECK (price &gt; 0)</code></li><li>Попробуйте вставить двух клиентов с одинаковым email — сработает <code>UNIQUE</code></li></ul>",
  hint:"Порядок удаления идёт от листьев к корню: order_items → orders → customers.",
  checks:[
   {label:"Удаление клиента заблокировано внешним ключом", test:st=>st.log.some(e=>e.err&&/внешн/i.test(e.err)&&/delete/i.test(e.sql))},
   {label:"Посчитаны заказы этого клиента", test:st=>st.log.some(e=>!e.err&&/count[\s\S]*orders[\s\S]*customer_id\s*=\s*1/i.test(e.sql))},
   {label:"Клиент удалён после удаления потомков", test:st=>!tbl(st,"customers").rows.some(r=>r[0]===1)},
   {label:"<code>CHECK</code> не пропустил нулевую цену", test:st=>st.log.some(e=>e.err&&/проверк|check/i.test(e.err)&&/products/i.test(e.sql))},
   {label:"<code>UNIQUE</code> не пропустил дубликат почты", test:st=>st.log.some(e=>e.err&&/уникальн/i.test(e.err))}
  ]}
]
},

/* ------------------------------------------------ 12 */
{
n:12, id:"perf", title:"Производительность", sub:"Индексы и EXPLAIN",
lede:"Почему запрос медленный, что показывает план выполнения и какие привычки в написании условий позволяют базе воспользоваться индексом.",
theory:`
<h2>Что такое индекс</h2>
<p>Индекс — отдельная структура (обычно B-дерево), хранящая значения столбца в отсортированном виде вместе со ссылками на строки. Он превращает полный перебор в спуск по дереву: вместо чтения миллиона строк — несколько обращений.</p>
<div class="note warn"><b class="hd">Индекс не бесплатен</b><p>Каждая вставка, обновление и удаление обязаны обновить все индексы таблицы. Индекс занимает место и требует времени на поддержку. Поэтому их создают под реальные запросы, а не «на каждый столбец про запас» — таблица с десятком индексов пишется в разы медленнее.</p></div>

<h2>EXPLAIN</h2>
<pre><code><span class="k">EXPLAIN</span> <span class="k">SELECT</span> * <span class="k">FROM</span> orders <span class="k">WHERE</span> customer_id = 3;
<span class="k">EXPLAIN ANALYZE</span> <span class="k">SELECT</span> …   <span class="c">-- в настоящем PostgreSQL: ещё и выполнит, показав фактическое время</span></code></pre>
<div class="tw"><table>
<tr><th>Узел плана</th><th>Что значит</th><th>Когда тревожно</th></tr>
<tr><td><code>Seq Scan</code></td><td>чтение всей таблицы подряд</td><td>на большой таблице с узким условием</td></tr>
<tr><td><code>Index Scan</code></td><td>спуск по индексу и чтение найденных строк</td><td>обычно хорошо</td></tr>
<tr><td><code>Bitmap Heap Scan</code></td><td>индекс дал много строк — собираются пачкой</td><td>нормально при средней выборке</td></tr>
<tr><td><code>Nested Loop</code></td><td>для каждой строки слева ищем справа</td><td>плохо, когда слева много строк</td></tr>
<tr><td><code>Hash Join</code></td><td>строится хеш-таблица меньшей стороны</td><td>хорошо для больших наборов</td></tr>
<tr><td><code>Sort</code></td><td>явная сортировка</td><td>если её мог бы дать индекс</td></tr>
</table></div>
<p>На маленькой таблице <code>Seq Scan</code> — правильный выбор: прочитать сто строк подряд дешевле, чем ходить через индекс. Планировщик опирается на статистику, а не на форму запроса, поэтому «индекс не используется» часто означает «база посчитала, что так дешевле», и это чаще всего правда.</p>

<h2>Условия, дружелюбные к индексу</h2>
<div class="note trap"><b class="hd">Функция вокруг столбца отключает обычный индекс</b>
<pre style="margin:.5em 0"><code><span class="c">-- индекс по created_at не поможет: значение вычисляется для каждой строки</span>
<span class="k">WHERE</span> date_trunc('day', created_at) = '2025-07-01'

<span class="c">-- поможет</span>
<span class="k">WHERE</span> created_at &gt;= '2025-07-01' <span class="k">AND</span> created_at &lt; '2025-07-02'</code></pre>
<p>То же с приведением типов и с <code>lower(email) = …</code>. Если запрос по выражению нужен постоянно, создают индекс по этому выражению: <code>CREATE INDEX ON users (lower(email));</code>.</p></div>
<div class="tw"><table>
<tr><th>Вместо</th><th>Пишите</th></tr>
<tr><td><code>WHERE year(d) = 2025</code></td><td><code>d &gt;= '2025-01-01' AND d &lt; '2026-01-01'</code></td></tr>
<tr><td><code>WHERE id::text = '42'</code></td><td><code>id = 42</code></td></tr>
<tr><td><code>WHERE name LIKE '%иванов%'</code></td><td>префикс, триграммный индекс или полнотекстовый поиск</td></tr>
</table></div>

<h2>Составной индекс и порядок столбцов</h2>
<p>Индекс по <code>(status, ordered_at)</code> годится для условий по <code>status</code> и по обоим столбцам сразу, но <b>не</b> для условия только по <code>ordered_at</code>: дерево отсортировано сначала по первому столбцу. Правило: сначала столбцы с равенством, затем тот, по которому идёт диапазон или сортировка.</p>

<h2>Задача N + 1</h2>
<div class="note trap"><b class="hd">Самая дорогая ошибка — не в SQL, а вокруг него</b><p>Приложение получает список из 100 заказов, а затем в цикле делает 100 запросов «дай клиента этого заказа». Каждый запрос сам по себе мгновенный, но сто обращений по сети превращаются в секунды. Лечится одним соединением или одним запросом с <code>WHERE id IN (…)</code>. В ORM за это отвечают «жадная загрузка» и <code>Include</code>.</p></div>

<h2>Порядок действий, когда запрос тормозит</h2>
<ol>
<li>Измерьте: <code>EXPLAIN ANALYZE</code>, а не догадки.</li>
<li>Найдите узел с наибольшим фактическим временем — не с наибольшей оценкой.</li>
<li>Сравните ожидаемое число строк с фактическим: сильное расхождение означает устаревшую статистику — выполните <code>ANALYZE</code>.</li>
<li>Проверьте, нет ли функции вокруг столбца в условии.</li>
<li>Только потом добавляйте индекс — и убедитесь по плану, что он используется.</li>
</ol>
`,
quiz:[
 {q:"Почему не стоит создавать индексы на все столбцы подряд?",
  opts:["База не позволит больше пяти","Каждая запись обязана обновить все индексы — вставки и обновления замедляются","Индексы конфликтуют друг с другом","Они занимают оперативную память целиком"],
  a:1, why:"Индекс ускоряет чтение и замедляет запись, а также занимает место. Его создают под конкретный запрос, который действительно нужен."},
 {q:"На таблице в сто строк план показывает <code>Seq Scan</code>. Это проблема?",
  opts:["Да, всегда","Нет: прочитать маленькую таблицу подряд дешевле, чем ходить через индекс","Да, нужен индекс","Означает отсутствие статистики"],
  a:1, why:"Планировщик выбирает по оценке стоимости. На малых объёмах последовательное чтение действительно быстрее."},
 {q:"Почему <code>WHERE date_trunc('day', created_at) = '2025-07-01'</code> не использует обычный индекс?",
  opts:["date_trunc работает медленно","Индекс хранит значения столбца, а не результат функции от него","Нужны кавычки другого вида","Индексы не работают с датами"],
  a:1, why:"Условие переписывают в диапазон по самому столбцу — либо создают индекс по выражению."},
 {q:"Индекс по <code>(status, ordered_at)</code>. Для какого условия он бесполезен?",
  opts:["<code>status = 'новый'</code>","Только <code>ordered_at &gt; '2025-01-01'</code>","Оба условия вместе","<code>status IN (…)</code>"],
  a:1, why:"Дерево упорядочено сначала по первому столбцу, поэтому по второму без первого искать нельзя — как по алфавитному указателю по фамилии искать по имени."},
 {q:"Что такое проблема N + 1?",
  opts:["Переполнение счётчика","Один запрос за списком и по запросу на каждый его элемент вместо одного соединения","Лишний индекс","Нехватка соединений в пуле"],
  a:1, why:"Каждый запрос быстрый, но сотня обращений по сети складывается в секунды. Решение — соединение или один запрос с IN."},
 {q:"На что смотреть в первую очередь в <code>EXPLAIN ANALYZE</code>?",
  opts:["На общую оценку стоимости","На узел с наибольшим фактическим временем и на расхождение оценки строк с фактом","На число узлов плана","На имена таблиц"],
  a:1, why:"Оценка — это предположение планировщика. Сильное расхождение с фактом обычно означает устаревшую статистику и объясняет неудачный план."}
],
labs:[
 {id:"12a", title:"Читать план",
  brief:"<h3>Читать план</h3><p>Учебный движок показывает упрощённый план — достаточный, чтобы видеть, что и в каком порядке делает база.</p><ul><li><code>EXPLAIN SELECT * FROM orders;</code> — увидите последовательное чтение</li><li><code>EXPLAIN SELECT * FROM orders WHERE customer_id = 3;</code> — появится фильтр</li><li>План соединения заказов с клиентами</li><li>План запроса с <code>GROUP BY</code> и <code>ORDER BY</code> — увидите этапы агрегации и сортировки</li></ul>",
  hint:"EXPLAIN ставится перед любым SELECT. Сам запрос при этом не выполняется.",
  checks:[
   {label:"Получен план простого чтения", test:st=>st.log.some(e=>!e.err&&/^\s*explain/i.test(e.sql)&&e.res&&/Seq Scan/i.test(JSON.stringify(e.res.rows)))},
   {label:"В плане появился фильтр", test:st=>st.log.some(e=>!e.err&&/^\s*explain/i.test(e.sql)&&e.res&&/Filter/i.test(JSON.stringify(e.res.rows)))},
   {label:"Получен план соединения", test:st=>st.log.some(e=>!e.err&&/^\s*explain/i.test(e.sql)&&e.res&&/Join/i.test(JSON.stringify(e.res.rows)))},
   {label:"В плане видны агрегация и сортировка", test:st=>st.log.some(e=>!e.err&&/^\s*explain/i.test(e.sql)&&e.res&&/Aggregate/i.test(JSON.stringify(e.res.rows))&&/Sort/i.test(JSON.stringify(e.res.rows)))}
  ]},
 {id:"12b", title:"Переписать условие",
  brief:"<h3>Переписать условие</h3><p>Приведите условия к форме, дружелюбной к индексу.</p><ul><li>Найдите заказы июля через <code>date_part('month', ordered_at) = 7</code> — работает, но для каждой строки вычисляется функция</li><li>Перепишите это же условие через диапазон дат — результат должен совпасть</li><li>Найдите клиента по почте через <code>lower(email) = …</code>, затем перепишите через прямое сравнение</li><li>Постройте отчёт «клиент — число заказов» одним запросом с <code>LEFT JOIN</code> и <code>GROUP BY</code> вместо восьми отдельных запросов на каждого клиента</li></ul>",
  hint:"Июль 2025 — это ordered_at >= '2025-07-01' AND ordered_at < '2025-08-01'. Один отчёт вместо цикла — это и есть лекарство от N+1.",
  checks:[
   {label:"Условие с функцией по дате выполнено", test:st=>ran(st,/date_part\s*\(/i)},
   {label:"То же условие переписано через диапазон", test:st=>{
     const a = st.log.find(e=>!e.err&&/date_part/i.test(e.sql)&&e.res);
     const b = st.log.find(e=>!e.err&&/ordered_at\s*>=\s*'2025-07-01'/i.test(e.sql)&&e.res);
     return a&&b&&JSON.stringify(a.res.rows)===JSON.stringify(b.res.rows)&&a.res.rows.length>0;}},
   {label:"Поиск по почте переписан без функции", test:st=>ran(st,/lower\s*\(\s*email/i)&&st.log.some(e=>!e.err&&/email\s*=\s*'/i.test(e.sql)&&e.res&&e.res.rows.length===1)},
   {label:"Отчёт получен одним запросом", test:st=>st.log.some(e=>!e.err&&/left\s+join[\s\S]*group\s+by/i.test(e.sql)&&e.res&&e.res.rows.length===8)}
  ]}
]
}

];
