document.getElementById('loginBtn').addEventListener('click', async () => {
  const mobile = document.getElementById('mobile').value.trim();
  const password = document.getElementById('password').value;

  if (!mobile || !password) {
    alert('Please enter your mobile number in both fields.');
    return;
  }
  
  // Validation for exactly 10 digits
  if (!/^\d{10}$/.test(mobile)) {
    alert('Mobile number must be exactly 10 digits.');
    return;
  }

  if (mobile !== password) {
    alert('Please confirm your mobile number correctly.');
    return;
  }

  try {
    const res = await fetch('/api/user/login-or-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, password })
    });

    const data = await res.json();

    if (res.ok) {
      window.location.href = '/index.html';
    } else {
      alert(data.error || 'An error occurred. Please try again.');
    }
  } catch (error) {
    alert('Network error. Please check your connection and try again.');
  }
});










// document.getElementById('loginBtn').addEventListener('click', async () => {
//   const mobile = document.getElementById('mobile').value.trim();
//   const password = document.getElementById('password').value;
//   const msg = document.getElementById('msg');
//   msg.innerText = '';

//   if (!mobile || !password) {
//     msg.innerText = 'Please enter your mobile number in both fields.';
//     return;
//   }
//   if (mobile !== password) {
//       msg.innerText = 'The entries in both fields must match.';
//       return;
//   }

//   const res = await fetch('/api/user/login-or-register', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ mobile, password })
//   });

//   const data = await res.json();
//   if (res.ok) {
//     window.location.href = '/index.html';
//   } else {
//     msg.innerText = data.error || 'An error occurred. Please try again.';
//   }
// });