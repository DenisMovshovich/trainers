let pass=0, fail=0;
function q(sql, db){ return runSql(db || newDb(), sql); }
function T(name, sql, expect, db){
  let r;
  try{ r = q(sql, db); }catch(e){ console.log("✗ "+name+" — ОШИБКА: "+e.message); fail++; return null; }
  const last = r[r.length-1];
  let ok = true, why = [];
  if(expect.cols && JSON.stringify(last.cols) !== JSON.stringify(expect.cols)){ ok=false; why.push("столбцы "+JSON.stringify(last.cols)); }
  if(expect.rows !== undefined && JSON.stringify(last.rows) !== JSON.stringify(expect.rows)){ ok=false; why.push("строки "+JSON.stringify(last.rows)); }
  if(expect.n !== undefined && (!last.rows || last.rows.length !== expect.n)){ ok=false; why.push("строк "+(last.rows?last.rows.length:"нет")+" вместо "+expect.n); }
  if(expect.msg && !(last.message||"").includes(expect.msg)){ ok=false; why.push("сообщение "+JSON.stringify(last.message)); }
  if(expect.check && !expect.check(last, r)){ ok=false; why.push("своя проверка"); }
  if(ok) pass++; else { fail++; console.log("✗ "+name+" → "+why.join("; ")); }
  return last;
}
function TE(name, sql, frag, db){
  try{ q(sql, db); console.log("✗ "+name+" — ожидалась ошибка, но её не было"); fail++; }
  catch(e){ if(String(e.message).includes(frag)){ pass++; } else { fail++; console.log("✗ "+name+" → ошибка «"+e.message+"» не содержит «"+frag+"»"); } }
}

console.log("── SELECT и выражения");
T("простой select","select 1 as n",{cols:["n"],rows:[[1]]});
T("арифметика","select 2+3*4 as v",{rows:[[14]]});
T("целочисленное деление","select 7/2 as v",{rows:[[3]]});
T("конкатенация","select 'а' || 'б' as v",{rows:[["аб"]]});
T("столбцы таблицы","select id, name from customers where id = 1",{cols:["id","name"],rows:[[1,"Ада Лавлейс"]]});
T("звёздочка","select * from customers where id = 2",{check:l=>l.cols.length===5&&l.rows[0][1]==="Грейс Хоппер"});
T("псевдоним таблицы","select c.name from customers c where c.id = 3",{rows:[["Алан Тьюринг"]]});
T("выражение с псевдонимом","select price * 2 as double_price from products where id = 2",{cols:["double_price"],rows:[[3800]]});
T("upper/lower","select upper('абв') as u",{rows:[["АБВ"]]});
T("coalesce","select coalesce(city, 'не указан') as c from customers where id = 5",{rows:[["не указан"]]});

console.log("── WHERE и предикаты");
T("сравнение","select count(*) as n from products where price > 20000",{rows:[[5]]});
T("AND","select count(*) as n from products where price > 5000 and stock > 5",{rows:[[3]]});
T("OR","select count(*) as n from products where category = 'мебель' or category = 'мониторы'",{rows:[[3]]});
T("IN","select count(*) as n from orders where status in ('доставлен','в пути')",{rows:[[9]]});
T("NOT IN","select count(*) as n from orders where status not in ('доставлен')",{rows:[[6]]});
T("BETWEEN","select count(*) as n from products where price between 1000 and 10000",{rows:[[5]]});
T("LIKE","select count(*) as n from products where title like 'Монитор%'",{rows:[[2]]});
T("ILIKE","select count(*) as n from customers where email ilike '%EXAMPLE%'",{rows:[[8]]});

console.log("── NULL и трёхзначная логика");
T("IS NULL","select count(*) as n from customers where city is null",{rows:[[2]]});
T("= NULL ничего не находит","select count(*) as n from customers where city = null",{rows:[[0]]});
T("<> не берёт NULL","select count(*) as n from customers where city <> 'Лондон'",{rows:[[4]]});
T("NULL в арифметике","select 1 + null as v",{rows:[[null]]});
T("NULL в конкатенации","select 'а' || null as v",{rows:[[null]]});
T("NOT IN с NULL даёт пусто","select count(*) as n from customers where id not in (select manager_id from employees)",{rows:[[0]]});
T("NOT EXISTS работает","select count(*) as n from customers c where not exists (select 1 from orders o where o.customer_id = c.id)",{rows:[[2]]});
T("IS DISTINCT FROM","select (null is distinct from null) as a, (1 is distinct from null) as b",{rows:[[false,true]]});
T("COUNT(col) пропускает NULL","select count(*) as a, count(city) as b from customers",{rows:[[8,6]]});

console.log("── сортировка и ограничение");
T("ORDER BY","select title from products order by price desc limit 1",{rows:[["Ноутбук 16\""]]});
T("ORDER BY по номеру","select title, price from products order by 2 asc limit 1",{rows:[["Мышь",1900]]});
T("NULLS по умолчанию в конце","select city from customers order by city limit 8",{check:l=>l.rows[7][0]===null&&l.rows[6][0]===null});
T("NULLS FIRST","select city from customers order by city nulls first limit 1",{rows:[[null]]});
T("LIMIT/OFFSET","select id from products order by id limit 3 offset 2",{rows:[[3],[4],[5]]});
T("DISTINCT","select distinct category from products order by category",{rows:[["компьютеры"],["мебель"],["мониторы"],["периферия"]]});

console.log("── агрегаты и GROUP BY");
T("count","select count(*) as n from orders",{rows:[[12]]});
T("sum","select sum(qty) as n from order_items",{rows:[[27]]});
T("avg округление","select round(avg(price)) as a from products",{rows:[[33250]]});
T("min/max","select min(price) as a, max(price) as b from products",{rows:[[1900,129900]]});
T("group by","select category, count(*) as n from products group by category order by category",
  {rows:[["компьютеры",2],["мебель",1],["мониторы",2],["периферия",5]]});
T("having","select category, count(*) as n from products group by category having count(*) > 1 order by category",
  {rows:[["компьютеры",2],["мониторы",2],["периферия",5]]});
T("count distinct","select count(distinct customer_id) as n from orders",{rows:[[6]]});
T("агрегат без group by по пустому набору","select count(*) as n, sum(price) as s from products where price > 999999",{rows:[[0,null]]});
TE("агрегат в WHERE","select * from products where count(*) > 1","агрегат");

console.log("── соединения");
T("inner join","select count(*) as n from orders o join customers c on c.id = o.customer_id",{rows:[[12]]});
T("left join сохраняет всех","select count(*) as n from customers c left join orders o on o.customer_id = c.id",{rows:[[14]]});
T("left join находит без заказов","select count(*) as n from customers c left join orders o on o.customer_id = c.id where o.id is null",{rows:[[2]]});
T("условие в ON против WHERE","select count(*) as n from customers c left join orders o on o.customer_id = c.id and o.status = 'отменён'",{rows:[[8]]});
T("cross join","select count(*) as n from customers cross join products",{rows:[[80]]});
T("self join","select e.name, m.name as manager from employees e join employees m on m.id = e.manager_id where e.id = 3",
  {rows:[["Анна Морозова","Пётр Крылов"]]});
T("three-table join","select count(*) as n from orders o join order_items i on i.order_id = o.id join products p on p.id = i.product_id",{rows:[[20]]});
T("using","select count(*) as n from orders o join order_items i using (id)",{check:l=>typeof l.rows[0][0]==="number"});

console.log("── подзапросы");
T("скалярный подзапрос","select (select count(*) from orders) as n",{rows:[[12]]});
T("IN с подзапросом","select count(*) as n from customers where id in (select customer_id from orders)",{rows:[[6]]});
T("EXISTS","select count(*) as n from customers c where exists (select 1 from orders o where o.customer_id = c.id)",{rows:[[6]]});
T("коррелированный подзапрос","select c.name, (select count(*) from orders o where o.customer_id = c.id) as cnt from customers c where c.id = 1",
  {rows:[["Ада Лавлейс",3]]});
T("подзапрос в FROM","select avg(n) as a from (select customer_id, count(*) as n from orders group by customer_id) t",
  {check:l=>Math.abs(l.rows[0][0]-2)<0.01});
T("> ALL","select count(*) as n from products where price > all (select price from products where category = 'периферия')",{rows:[[5]]});
TE("подзапрос вернул много строк","select (select id from orders) as x","больше одной строки");

console.log("── CTE и множества");
T("with","with c as (select * from products where price > 20000) select count(*) as n from c",{rows:[[5]]});
T("union","select 1 as v union select 2 union select 1 order by v",{rows:[[1],[2]]});
T("union all","select 1 as v union all select 1",{n:2});
T("except","select id from customers except select customer_id from orders",{n:2});
T("intersect","select id from customers intersect select customer_id from orders",{n:6});
T("рекурсивный CTE","with recursive t(n) as (select 1 union all select n+1 from t where n < 5) select count(*) as c from t",{rows:[[5]]});

console.log("── оконные функции");
T("row_number","select name, row_number() over (order by salary desc) as r from employees limit 1",{rows:[["Ирина Соколова",1]]});
T("rank с partition","select name, rank() over (partition by department order by salary desc) as r from employees where department = 'разработка' order by r",
  {rows:[["Пётр Крылов",1],["Анна Морозова",2],["Сергей Волков",3]]});
T("сумма в окне","select department, sum(salary) over (partition by department) as s from employees where department = 'аналитика' limit 1",
  {rows:[["аналитика",375000]]});
T("lag","select name, lag(salary) over (order by id) as prev from employees limit 2",{check:l=>l.rows[0][1]===null&&l.rows[1][1]===320000});

console.log("── изменение данных");
{
  const db = newDb();
  T("insert","insert into customers (id,name,email,city,created_at) values (9,'Тест','t@e.com','Пермь','2025-08-01')",{msg:"INSERT 1"},db);
  T("после insert","select count(*) as n from customers",{rows:[[9]]},db);
  TE("дубликат первичного ключа","insert into customers (id,name,email) values (9,'Ещё','x@e.com')","уникальност",db);
  TE("нарушение NOT NULL","insert into customers (id,name,email) values (10,null,'y@e.com')","NOT NULL",db);
  TE("нарушение внешнего ключа","insert into orders (id,customer_id,ordered_at,status) values (99,999,'2025-08-01','новый')","внешний ключ",db);
  TE("нарушение CHECK","insert into products (id,title,category,price,stock) values (11,'Плохой','тест',-5,1)","CHECK",db);
  T("update","update customers set city = 'Казань' where id = 9",{msg:"UPDATE 1"},db);
  T("проверка update","select city from customers where id = 9",{rows:[["Казань"]]},db);
  T("delete","delete from customers where id = 9",{msg:"DELETE 1"},db);
  TE("удаление с зависимостями","delete from customers where id = 1","ссылается",db);
  T("returning","insert into customers (id,name,email) values (20,'Возврат','r@e.com') returning id, name",
    {cols:["id","name"],rows:[[20,"Возврат"]]},db);
}
{
  const db = newDb();
  T("upsert do nothing","insert into customers (id,name,email) values (1,'Дубль','d@e.com') on conflict (id) do nothing",{msg:"INSERT 0"},db);
  T("upsert do update","insert into customers (id,name,email) values (1,'Новое имя','ada@example.com') on conflict (id) do update set name = 'Новое имя'",{check:()=>true},db);
  T("после upsert","select name from customers where id = 1",{rows:[["Новое имя"]]},db);
}
{
  const db = newDb();
  T("транзакция: begin","begin",{msg:"BEGIN"},db);
  T("удаление внутри","delete from order_items",{msg:"DELETE 20"},db);
  T("rollback","rollback",{msg:"ROLLBACK"},db);
  T("данные вернулись","select count(*) as n from order_items",{rows:[[20]]},db);
}

console.log("── DDL и EXPLAIN");
{
  const db = newDb();
  T("create table","create table t (id integer primary key, name text not null, price numeric check (price > 0))",{msg:"CREATE TABLE"},db);
  T("insert в новую","insert into t values (1,'а',10)",{msg:"INSERT 1"},db);
  TE("check в новой","insert into t values (2,'б',-1)","CHECK",db);
  T("drop","drop table t",{msg:"DROP TABLE"},db);
}
T("explain","explain select * from customers where id = 1",{check:l=>l.rows.some(r=>/Index Scan/.test(r[0]))});
T("explain с join","explain select * from orders o join customers c on c.id = o.customer_id",{check:l=>l.rows.some(r=>/Join/.test(r[0]))});


console.log("── регрессии");
T("скалярный подзапрос не схлопывает строки",
  "SELECT title, price - (SELECT round(avg(price)) FROM products) AS d FROM products", {n:10});
T("коррелированный подзапрос в списке выборки",
  "SELECT c.name, (SELECT count(*) FROM orders o WHERE o.customer_id = c.id) AS n FROM customers c", {n:8});
T("EXISTS в списке выборки не делает запрос агрегатным",
  "SELECT c.id, EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id) AS e FROM customers c", {n:8});
T("FILTER у агрегата",
  "SELECT count(*) AS a, count(*) FILTER (WHERE status = 'доставлен') AS b FROM orders",
  {rows:[[12,6]]});
T("FILTER вместе с GROUP BY",
  "SELECT customer_id, count(*) FILTER (WHERE status = 'доставлен') FROM orders GROUP BY customer_id ORDER BY customer_id",
  {n:6});
TE("оконная функция в WHERE запрещена",
  "SELECT title FROM products WHERE row_number() OVER (ORDER BY price) <= 2", "оконные функции");
TE("оконная функция в HAVING запрещена",
  "SELECT category FROM products GROUP BY category HAVING row_number() OVER () = 1", "оконные функции");
(function(){
  const db = newDb();
  q("INSERT INTO customers (id, name, email, city) VALUES (21, 'X', 'ada@example.com', 'Уфа') ON CONFLICT (email) DO UPDATE SET city = excluded.city", db);
  T("excluded в ON CONFLICT DO UPDATE", "SELECT city FROM customers WHERE id = 1", {rows:[["Уфа"]]}, db);
  T("строка не добавилась", "SELECT count(*) FROM customers", {rows:[[8]]}, db);
})();
TE("внешний ключ мешает удалению", "DELETE FROM customers WHERE id = 1", "внешний ключ");

console.log("\nитог: "+pass+" пройдено, "+fail+" провалено");
process.exit(fail?1:0);
