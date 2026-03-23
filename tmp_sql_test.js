const initSqlJs=require('sql.js');
(async()=>{
  const SQL=await initSqlJs();
  const db=new SQL.Database();
  db.run('CREATE TABLE owner_documents(id TEXT PRIMARY KEY,name TEXT,ownerId TEXT,ownerName TEXT,sessionAmount REAL,status TEXT,notarizedAt INTEGER,uploadedAt INTEGER,paymentStatus TEXT,paymentPaidAt INTEGER)');
  db.run("INSERT INTO owner_documents VALUES ('1','Doc1','o1','Owner1',100,'notarized',123456,123000,'paid',123456)");
  const r=db.exec("SELECT id,id as documentId,name as documentName,ownerId,ownerName,sessionAmount,status,notarizedAt,uploadedAt,paymentStatus,paymentPaidAt FROM owner_documents WHERE ownerId='o1' ORDER BY uploadedAt DESC LIMIT 50");
  console.log(JSON.stringify(r,null,2));
})();