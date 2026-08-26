const fs=require('fs');
eval(fs.readFileSync('model.js','utf8'));
eval(fs.readFileSync('build/50_decode.js','utf8'));
const samples=[
 ["Pages/CommonElements/HeaderElements.cs","ProductsButton"],
 ["Pages/CommonElements/NavBarElements.cs","DedicatedDeskButton"],
 ["Pages/LocationPage.cs","HeroSubmitButton"],
 ["Pages/ExplorePage.cs","SuggestionItems"],
 ["Pages/ContactFormPage.cs","TourDayButtonLocator"],
 ["Pages/CommonElements/FooterElements.cs","PrivacyPolicyButton"],
 ["Pages/ContactFormPage.cs","OptionTileLocator"],
 ["Pages/CommonElements/NavBarElements.cs","MeetingRoomsButton"]
];
for(const [f,n] of samples){
  const m=MODEL[f].cl[0].mem.find(x=>x.n===n);
  const d=decodeSelector(m.b);
  console.log("\n"+f.split("/").pop()+" · "+n);
  console.log("   тело: "+m.b.slice(0,88));
  console.log("   тип: "+d.kind);
  d.notes.forEach(x=>console.log("    · "+x[0]+" → "+x[1].replace(/<[^>]+>/g,"").slice(0,96)));
  d.chain.forEach(x=>console.log("    ⛓ "+x[0]));
}
// покрытие: сколько локаторов декодируется
let loc=0, dec=0;
Object.values(MODEL).forEach(v=>(v.cl||[]).forEach(c=>c.mem.forEach(x=>{
  if(x.t==="ILocator"){ loc++; if(decodeSelector(x.b).sel) dec++; }
})));
console.log("\nлокаторов:", loc, "| декодировано:", dec, "("+Math.round(dec/loc*100)+"%)");
// сколько членов имеют комментарий в коде
let mem=0, doc=0;
Object.values(MODEL).forEach(v=>(v.cl||[]).forEach(c=>c.mem.forEach(x=>{ mem++; if(x.d) doc++; })));
console.log("членов:", mem, "| с комментарием в коде:", doc, "("+Math.round(doc/mem*100)+"%)");
