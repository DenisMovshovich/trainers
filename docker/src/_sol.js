const SOL = {
"1a":["docker version","docker pull alpine:3.19","docker images","docker run alpine:3.19 echo привет","docker ps -a"],
"1b":["docker run alpine:3.19","docker run -d --name sleeper alpine:3.19 sleep 600","docker ps","docker stop sleeper","docker rm sleeper"],
"2a":["docker pull nginx:alpine","docker pull alpine:3.19","docker images","docker history nginx:alpine","docker inspect nginx:alpine"],
"2b":["docker pull alpine:3.19","docker tag alpine:3.19 mybase:v1","docker images","docker rmi mybase:v1","docker images"],
"3a":["docker create --name box alpine:3.19 sleep 300","docker ps -a","docker start box","docker ps","docker stop box","docker rm box"],
"3b":["docker run -d --name web -p 8080:80 nginx:alpine","docker ps","docker logs web","curl http://localhost:8080",
      "docker exec -it web sh","ls /usr/share/nginx/html","cat /usr/share/nginx/html/index.html","exit"],
"3c":["docker run alpine:3.19 echo раз","docker run --rm alpine:3.19 echo два","docker ps -a","docker system prune"],
"4a":["echo 'FROM nginx:alpine\\nCOPY index.html /usr/share/nginx/html/index.html\\nEXPOSE 80' > Dockerfile",
      "cat Dockerfile","docker build -t site:1.0 .","docker run -d --name site -p 8080:80 site:1.0","curl http://localhost:8080"],
"4b":["echo 'FROM alpine:3.19\\nCMD [\"echo\",\"привет\"]' > Dockerfile","docker build -t greeter:cmd .",
      "docker run greeter:cmd","docker run greeter:cmd пока",
      "echo 'FROM alpine:3.19\\nENTRYPOINT [\"echo\"]' > Dockerfile","docker build -t greeter:entry .","docker run greeter:entry пока"],
"5a":["docker build -t api:1.0 .","docker build -t api:1.0 .","echo 'console.log(2)' > server.js","docker build -t api:1.0 .",
      "echo 'FROM node:20-alpine\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm ci --omit=dev\\nCOPY . .\\nCMD [\"node\",\"server.js\"]' > Dockerfile",
      "docker build -t api:2.0 .","echo 'console.log(3)' > server.js","docker build -t api:2.1 ."],
"5b":["docker build -t app:1.0 .","echo 'node_modules\\n*.log\\n.env' > .dockerignore","docker build -t app:2.0 .",
      "docker run -d --name t app:2.0 sleep 300","docker exec t cat /app/.env"],
"6a":["docker build -t app:fat .",
      "echo 'FROM golang:1.22-alpine AS builder\\nWORKDIR /src\\nCOPY . .\\nRUN go build -o /out/app .\\n\\nFROM alpine:3.19\\nCOPY --from=builder /out/app /usr/local/bin/app\\nENTRYPOINT [\"/usr/local/bin/app\"]' > Dockerfile",
      "docker build -t app:slim .","docker images"],
"6b":["cat Dockerfile","docker build --target builder -t app:build .","docker images","docker history app:build"],
"7a":["docker volume create appdata","docker run -d --name box -v appdata:/data alpine:3.19 sleep 600",
      "docker exec box sh -c \"echo важные-данные > /data/notes.txt\"","docker rm -f box",
      "docker run -d --name box2 -v appdata:/data alpine:3.19 sleep 600","docker exec box2 cat /data/notes.txt"],
"7b":["docker run -d --name dev -p 8080:80 -v /work/site:/usr/share/nginx/html:ro nginx:alpine","curl http://localhost:8080",
      "echo '<h1>версия 2</h1>' > site/index.html","curl http://localhost:8080",
      "docker exec dev sh -c \"echo x > /usr/share/nginx/html/index.html\""],
"7c":["docker run -d --name db -e POSTGRES_PASSWORD=secret postgres:16-alpine","docker volume ls","docker rm -f db","docker volume ls","docker volume prune"],
"8a":["docker run -d --name web nginx:alpine","docker run -d --name client alpine:3.19 sleep 600",
      "docker exec client curl http://web","docker network create app-net",
      "docker network connect app-net web","docker network connect app-net client","docker exec client curl http://web"],
"8b":["docker network create backend","docker run -d --name db --network backend -e POSTGRES_PASSWORD=secret postgres:16-alpine",
      "docker run -d --name web --network backend -p 8080:80 nginx:alpine","curl http://localhost:8080",
      "curl http://localhost:5432","docker exec web ping db"],
"9a":["docker compose up -d","docker compose ps","curl http://localhost:8080","docker compose logs db","docker compose down"],
"9b":["echo 'services:\\n  cache:\\n    image: redis:7-alpine\\n    volumes:\\n      - cachedata:/data\\n  site:\\n    image: nginx:alpine\\n    ports:\\n      - \"8080:80\"\\n    depends_on:\\n      - cache\\n\\nvolumes:\\n  cachedata:' > docker-compose.yml",
      "cat docker-compose.yml","docker compose up -d","docker compose ps"],
"10a":["docker run -d --name db postgres:16-alpine","docker ps -a","docker logs db","docker inspect -f '{{.State.ExitCode}}' db",
       "docker rm db","docker run -d --name db -e POSTGRES_PASSWORD=secret postgres:16-alpine"],
"10b":["docker run -d --name web --memory 256m --cpus 0.5 --restart unless-stopped -p 8080:80 nginx:alpine","docker stats",
       "docker inspect -f '{{.HostConfig.Memory}}' web","docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' web"],
"11a":["docker build -t app:root .","docker run -d --name r1 app:root sleep 600","docker exec r1 whoami",
       "echo 'FROM node:20-alpine\\nWORKDIR /app\\nCOPY . .\\nRUN adduser -u 10001 -D app\\nUSER app\\nCMD [\"node\",\"server.js\"]' > Dockerfile",
       "docker build -t app:safe .","docker run -d --name s1 app:safe sleep 600","docker exec s1 whoami"],
"11b":["docker run -d --name hard --read-only --tmpfs /tmp --cap-drop ALL --user 10001 -p 8080:80 nginx:alpine",
       "docker exec hard sh -c \"echo x > /root-test\"","docker exec hard sh -c \"echo x > /tmp/ok\"","docker inspect hard"],
"12a":["echo 'FROM nginx:alpine\\nCOPY index.html /usr/share/nginx/html/index.html\\nEXPOSE 80\\nUSER nginx\\nHEALTHCHECK CMD wget -qO- http://localhost/ || exit 1\\nCMD [\"nginx\",\"-g\",\"daemon off;\"]' > Dockerfile",
       "docker build -t myapp:1.0.0 -t myapp:sha-a1b2c3d .",
       "docker run -d --name shop --memory 256m --restart unless-stopped -p 8080:80 myapp:1.0.0","docker ps"],
"12b":["docker network create prod-net","docker volume create pgdata",
       "docker run -d --name pgdb --network prod-net -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data --restart unless-stopped postgres:16-alpine",
       "echo 'FROM nginx:alpine\\nCOPY index.html /usr/share/nginx/html/index.html' > Dockerfile",
       "docker build -t shop:1.0.0 .",
       "docker run -d --name shopweb --network prod-net -p 8080:80 --memory 256m shop:1.0.0",
       "curl http://localhost:8080","docker exec shopweb ping pgdb",
       "docker tag shop:1.0.0 myteam/shop:1.0.0","docker push myteam/shop:1.0.0"]
};

let fails=0, labs=0, checksTotal=0;
MODULES.forEach(m=>{
  m.labs.forEach(l=>{
    labs++;
    const st=newState();
    try{ l.setup && l.setup(st); }catch(e){ console.log("SETUP ERR "+l.id+": "+e.message); fails++; }
    const script=SOL[l.id];
    if(!script){ console.log("!! нет решения для "+l.id); fails++; return; }
    const log=[];
    script.forEach(cmd=>{
      try{ const o=engineExec(st,cmd); log.push("$ "+cmd); o.L.forEach(x=>log.push("   "+(x.cls==="err"?"[err] ":"")+x.t)); }
      catch(e){ log.push("$ "+cmd+"  => THROW "+e.message+"\n"+e.stack.split("\n")[1]); fails++; }
    });
    const bad=[];
    l.checks.forEach(ch=>{
      checksTotal++;
      let ok=false; let err=null;
      try{ ok=!!ch.test(st, st.history); }catch(e){ err=e.message; }
      if(!ok) bad.push(ch.label.replace(/<[^>]+>/g,"")+(err?" [throw: "+err+"]":""));
    });
    if(bad.length){
      fails++;
      console.log("\n=== ЛАБА "+m.n+" · "+l.id+" — не зачтено "+bad.length+"/"+l.checks.length);
      bad.forEach(b=>console.log("   ✗ "+b));
      console.log(log.join("\n"));
    }
    // визуализация не должна падать
    try{ vizMap(st); vizLayers(st); vizState(st); vizFiles(st); }
    catch(e){ fails++; console.log("VIZ ERR "+l.id+": "+e.message); }
  });
});
console.log("\n--- заданий: "+labs+", критериев: "+checksTotal+", провалов: "+fails+" ---");
process.exit(fails?1:0);
