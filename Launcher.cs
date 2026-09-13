using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
class Launcher {
 static TcpListener server; static string root; static string url;
 static readonly ManualResetEvent quit=new ManualResetEvent(false);
 static long lastHeartbeat; static bool clientSeen;
 const string Policy="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; frame-src 'self' blob: https://edwardkim.github.io; worker-src 'self' blob:; object-src 'none'; base-uri 'self'";
 [STAThread] static int Main(string[] args){
  root=Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory);
  try{server=new TcpListener(IPAddress.Loopback,18764);server.Start();}
  catch(SocketException){server=new TcpListener(IPAddress.Loopback,0);server.Start();}
  url="http://127.0.0.1:"+((IPEndPoint)server.LocalEndpoint).Port+"/";
  var thread=new Thread(Serve);thread.IsBackground=true;thread.Start();
  if(args.Length>0 && args[0]=="--serve-only"){Console.WriteLine(url);Thread.Sleep(Timeout.Infinite);return 0;}
  Application.EnableVisualStyles();
  Open();
  while(!quit.WaitOne(1000)){
   if(clientSeen && DateTime.UtcNow.Ticks-Interlocked.Read(ref lastHeartbeat)>TimeSpan.FromSeconds(20).Ticks)break;
  }
  server.Stop();return 0;
 }
 static void Open(){try{Process.Start(new ProcessStartInfo(url){UseShellExecute=true});}catch(Exception e){MessageBox.Show("브라우저에서 다음 주소를 열어 주세요.\n"+url+"\n"+e.Message);}}
 static void Serve(){while(true){try{var c=server.AcceptTcpClient();ThreadPool.QueueUserWorkItem(delegate{Handle(c);});}catch{return;}}}
 static void Handle(TcpClient c){using(c){try{
  c.ReceiveTimeout=5000;c.SendTimeout=30000;
  var stream=c.GetStream();var reader=new StreamReader(stream,Encoding.ASCII,false,1024,true);
  string line=reader.ReadLine();if(line==null)return;var parts=line.Split(' ');
  if(parts.Length<2){Reply(stream,400,"text/plain",Encoding.UTF8.GetBytes("Bad request"));return;}
  string header;int size=0;while(!String.IsNullOrEmpty(header=reader.ReadLine())){size+=header.Length;if(size>16384)return;}
  string route=parts[1].Split('?')[0];
  if(parts[0]=="POST" && route=="/__heartbeat"){clientSeen=true;Interlocked.Exchange(ref lastHeartbeat,DateTime.UtcNow.Ticks);Reply(stream,200,"text/plain",Encoding.ASCII.GetBytes("ok"));return;}
  if(parts[0]!="GET" && parts[0]!="HEAD"){Reply(stream,405,"text/plain",new byte[0]);return;}
  string rel=Uri.UnescapeDataString(route).TrimStart('/').Replace('/',Path.DirectorySeparatorChar);
  if(rel.IndexOf(':')>=0 || rel.IndexOf('\0')>=0){Reply(stream,403,"text/plain",new byte[0]);return;}
  if(rel.Length==0)rel="index.html";if(rel.EndsWith(Path.DirectorySeparatorChar.ToString()))rel+="index.html";
  string p=Path.GetFullPath(Path.Combine(root,rel));
  if(!p.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)||!File.Exists(p)){Reply(stream,404,"text/plain",Encoding.UTF8.GetBytes("Not found"));return;}
  string ext=Path.GetExtension(p).ToLowerInvariant();
  string mime=ext==".html"?"text/html; charset=utf-8":ext==".js"?"text/javascript; charset=utf-8":ext==".css"?"text/css; charset=utf-8":ext==".wasm"?"application/wasm":ext==".svg"?"image/svg+xml":ext==".png"?"image/png":ext==".woff2"?"font/woff2":ext==".json"||ext==".webmanifest"?"application/json":"application/octet-stream";
  Reply(stream,200,mime,File.ReadAllBytes(p),parts[0]=="HEAD");
 }catch{}}}
 static void Reply(Stream s,int code,string mime,byte[] data,bool head=false){var h=Encoding.ASCII.GetBytes("HTTP/1.1 "+code+" "+(code==200?"OK":"Error")+"\r\nContent-Type: "+mime+"\r\nContent-Length: "+data.Length+"\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-cache\r\nContent-Security-Policy: "+Policy+"\r\n\r\n");s.Write(h,0,h.Length);if(!head)s.Write(data,0,data.Length);}
}

