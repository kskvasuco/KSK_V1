// fetch allowed locations then populate dropdowns
let LOCS = {};
const districtEl = document.getElementById('district');
const talukEl = document.getElementById('taluk');

fetch('/api/locations').then(r=>r.json()).then(obj=>{
  LOCS = obj;
  districtEl.innerHTML = '<option value="">Select district (Optional)</option>'; // MODIFIED Text
  for (const d of Object.keys(LOCS)) {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    districtEl.appendChild(opt);
  }
});

districtEl.addEventListener('change', ()=>{
  talukEl.innerHTML = '<option value="">Select taluk (Optional)</option>'; // MODIFIED Text
  const tlist = LOCS[districtEl.value] || [];
  for (const t of tlist){
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    talukEl.appendChild(opt);
  }
});

document.getElementById('registerBtn').addEventListener('click', async ()=>{
  const mobile = document.getElementById('mobile').value.trim();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const district = districtEl.value;
  const taluk = talukEl.value;
  const msg = document.getElementById('msg');

  // MODIFIED: Only validate the mandatory fields
  if (!mobile || !password) {
    msg.innerText = 'Please fill the mandatory Mobile Number fields';
    return;
  }
  if (password !== mobile) {
    msg.innerText = 'Password must equal mobile number';
    return;
  }

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ mobile, name, email, password, district, taluk })
  });
  const data = await res.json();
  if (res.ok) {
    msg.innerText = 'Registered & logged in—redirecting to products...';
    setTimeout(() => window.location.href = '/index.html', 1500); // Added a small delay
  } else {
    msg.innerText = data.error || 'Error';
  }
});