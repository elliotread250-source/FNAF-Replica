const DISCLAIMER =
  'FNAF Replica is an unofficial, non-commercial fan game. Five Nights at Freddy\'s and all related characters are the property of Scott Cawthon. This project is not affiliated with or endorsed by Scott Cawthon or Steel Wool Studios. All art, audio and code in this game are original.';
const app = document.getElementById('app') as HTMLElement;
app.innerHTML = '<h1 style="font-family:VT323,monospace;color:#c41e1e">FNAF Replica</h1>';
const p = document.createElement('p');
p.textContent = DISCLAIMER;
app.appendChild(p);
