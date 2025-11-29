(function(){
    // Sidebar tab switching
    document.querySelectorAll('.settings-nav a').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const target = a.getAttribute('data-target');
            document.querySelectorAll('.settings-nav a').forEach(n => n.classList.remove('active'));
            a.classList.add('active');
            document.querySelectorAll('.panel-section').forEach(p => p.classList.add('d-none'));
            document.getElementById(target).classList.remove('d-none');
        });
    });

    // Profile masking logic
    const root = document.getElementById('settingsRoot');
    if(!root) return; // page guard
    const email = root.getAttribute('data-email') || ''; const phone = root.getAttribute('data-phone') || '';
    function maskEmail(e){ if(!e) return ''; const i=e.indexOf('@'); if(i<=2) return e; return e.substring(0,2)+'********'+e.substring(i); }
    function maskPhone(p){ if(!p) return ''; if(p.length<4) return p; return '********'+p.slice(-2); }
    const emailMaskedEl = document.getElementById('EmailMasked');
    const phoneMaskedEl = document.getElementById('PhoneMasked');
    if(emailMaskedEl) emailMaskedEl.textContent = maskEmail(email);
    if(phoneMaskedEl) phoneMaskedEl.textContent = maskPhone(phone);

    // Photo upload preview
    const avatar = document.getElementById('profileAvatar');
    const uploadBtn = document.getElementById('uploadPhotoBtn');
    const photoInput = document.getElementById('photoInput');
    const photoStatus = document.getElementById('photoStatus');
    if(uploadBtn && photoInput && avatar){
        uploadBtn.addEventListener('click', ()=> photoInput.click());
        photoInput.addEventListener('change', ()=>{
            if(photoInput.files && photoInput.files[0]){
                const file = photoInput.files[0];
                if(!file.type.startsWith('image/')){ photoStatus.style.display='block'; photoStatus.textContent='Please select an image file.'; return; }
                const reader = new FileReader();
                reader.onload = e => {
                    avatar.style.backgroundImage = `url('${e.target.result}')`;
                    avatar.textContent='';
                    photoStatus.style.display='block';
                    photoStatus.textContent='Preview loaded (not yet saved).';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Dynamic additional emails/phones
    const extraEmailsContainer = document.getElementById('extraEmailsContainer');
    const extraPhonesContainer = document.getElementById('extraPhonesContainer');
    const addEmailBtn = document.getElementById('addEmailBtn');
    const addPhoneBtn = document.getElementById('addPhoneBtn');

    function createExtraBlock(type){
        const wrapper = document.createElement('div');
        wrapper.className='contact-extra';
        const id = `${type}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        wrapper.innerHTML = `<button type="button" class="remove-contact">Remove</button><h6>${type === 'email' ? 'Email' : 'Phone'}</h6><input type="${type==='email'?'email':'tel'}" class="form-control mb-2" placeholder="${type==='email'?'Additional email':'Additional phone'}" data-type="${type}" />`;
        wrapper.querySelector('.remove-contact').addEventListener('click', ()=> wrapper.remove());
        return wrapper;
    }
    if(addEmailBtn){ addEmailBtn.addEventListener('click', ()=> extraEmailsContainer.appendChild(createExtraBlock('email'))); }
    if(addPhoneBtn){ addPhoneBtn.addEventListener('click', ()=> extraPhonesContainer.appendChild(createExtraBlock('phone'))); }

    // Profile form submission
    const profileForm = document.getElementById('profileForm');
    if(profileForm){
        const saveProfileBtn = document.getElementById('saveProfileBtn');
        const profileStatus = document.getElementById('profileStatus');
        profileForm.addEventListener('submit', async (e)=>{
            e.preventDefault();
            const usernameInput = document.getElementById('Username');
            usernameInput.classList.remove('is-invalid');
            if(!usernameInput.value.trim()){ usernameInput.classList.add('is-invalid'); return; }
            saveProfileBtn.disabled=true; saveProfileBtn.textContent='Saving...';
            try {
                const additionalEmails = Array.from(extraEmailsContainer.querySelectorAll('input[data-type="email"]')).map(i=>i.value.trim()).filter(v=>v);
                const additionalPhones = Array.from(extraPhonesContainer.querySelectorAll('input[data-type="phone"]')).map(i=>i.value.trim()).filter(v=>v);
                const payload={
                    Username: usernameInput.value.trim(),
                    FullName: document.getElementById('FullName').value.trim(),
                    PhoneNumber: '',
                    AdditionalEmails: additionalEmails,
                    AdditionalPhones: additionalPhones,
                    BackupEmail: '',
                    EmergencyPhone: ''
                };
                const resp= await fetch(profileForm.getAttribute('action'), { method:'POST', headers:{ 'Content-Type':'application/json','RequestVerificationToken':document.querySelector('#profileForm input[name="__RequestVerificationToken"]').value }, body: JSON.stringify(payload) });
                const data = await resp.json();
                profileStatus.style.display='block';
                profileStatus.className=data.success? 'alert alert-success':'alert alert-danger';
                profileStatus.textContent=data.message||'Update failed';
            } catch(err){ profileStatus.style.display='block'; profileStatus.className='alert alert-danger'; profileStatus.textContent=err.message||String(err); }
            finally { saveProfileBtn.disabled=false; saveProfileBtn.textContent='Save'; }
        });
    }

    // Password form submission
    const pwdForm = document.getElementById('changePwdForm');
    if(pwdForm){
        const savePwdBtn = document.getElementById('savePwdBtn');
        const pwdStatus = document.getElementById('pwdStatus');
        pwdForm.addEventListener('submit', async (e)=>{
            e.preventDefault();
            pwdStatus.style.display='none';
            const payload = {
                CurrentPassword: document.getElementById('CurrentPassword').value,
                NewPassword: document.getElementById('NewPassword').value,
                ConfirmPassword: document.getElementById('ConfirmPassword').value
            };
            savePwdBtn.disabled = true; const old = savePwdBtn.textContent; savePwdBtn.textContent='Saving...';
            try{
                const resp = await fetch(pwdForm.getAttribute('action'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json','RequestVerificationToken': document.querySelector('#changePwdForm input[name="__RequestVerificationToken"]').value },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                pwdStatus.style.display='block';
                pwdStatus.className = data.success ? 'alert alert-success' : 'alert alert-danger';
                pwdStatus.textContent = data.message || (data.success ? 'Saved' : 'Failed');
                if(data.success){ pwdForm.reset(); }
            }catch(err){
                pwdStatus.style.display='block'; pwdStatus.className='alert alert-danger'; pwdStatus.textContent= err.message || String(err);
            }finally{ savePwdBtn.disabled=false; savePwdBtn.textContent=old; }
        });
    }
})();
