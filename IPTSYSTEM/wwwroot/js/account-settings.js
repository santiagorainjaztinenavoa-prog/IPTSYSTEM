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

    // Photo upload preview and Firebase upload
    const avatar = document.getElementById('profileAvatar');
    const uploadBtn = document.getElementById('uploadPhotoBtn');
    const photoInput = document.getElementById('photoInput');
    const photoStatus = document.getElementById('photoStatus');
    
    // Load existing photo from Firebase on page load
    async function loadProfilePhotoFromFirebase() {
        if (typeof currentUserId === 'undefined' || !currentUserId) return;
        
        // Wait for Firebase to be ready
        let retries = 0;
        while (typeof window.firebaseGetUserProfile !== 'function' && retries < 20) {
            await new Promise(function(r) { setTimeout(r, 300); });
            retries++;
        }
        
        if (typeof window.firebaseGetUserProfile === 'function') {
            try {
                const result = await window.firebaseGetUserProfile(currentUserId);
                if (result.success && result.profile && result.profile.photo_url) {
                    console.log('✅ Loaded profile photo from Firebase');
                    avatar.style.backgroundImage = `url('${result.profile.photo_url}')`;
                    avatar.textContent = '';
                }
            } catch (err) {
                console.warn('Could not load profile photo:', err);
            }
        }
    }
    
    // Load photo on page load
    if (avatar) {
        // First check if server provided a photo URL
        if (typeof currentPhotoUrl !== 'undefined' && currentPhotoUrl) {
            avatar.style.backgroundImage = `url('${currentPhotoUrl}')`;
            avatar.textContent = '';
        }
        // Then try to load from Firebase (will override if available)
        loadProfilePhotoFromFirebase();
    }
    
    if(uploadBtn && photoInput && avatar){
        uploadBtn.addEventListener('click', function(){ photoInput.click(); });
        photoInput.addEventListener('change', async function(){
            if(photoInput.files && photoInput.files[0]){
                const file = photoInput.files[0];
                if(!file.type.startsWith('image/')){ 
                    photoStatus.style.display='block'; 
                    photoStatus.className = 'small text-danger mt-2';
                    photoStatus.textContent='Please select an image file.'; 
                    return; 
                }
                
                // Check file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    photoStatus.style.display='block';
                    photoStatus.className = 'small text-danger mt-2';
                    photoStatus.textContent='File too large. Maximum size is 5MB.';
                    return;
                }
                
                // Show preview immediately using FileReader
                const previewReader = new FileReader();
                previewReader.onload = function(e) {
                    avatar.style.backgroundImage = `url('${e.target.result}')`;
                    avatar.textContent='';
                };
                previewReader.readAsDataURL(file);
                
                // Show uploading status
                photoStatus.style.display='block';
                photoStatus.className = 'small text-info mt-2';
                photoStatus.textContent='⏳ Uploading photo...';
                uploadBtn.disabled = true;
                
                // Upload to Firebase
                if (typeof currentUserId !== 'undefined' && currentUserId) {
                    // Wait for Firebase to be ready (up to 6 seconds)
                    let retries = 0;
                    while (typeof window.firebaseUploadProfilePhoto !== 'function' && retries < 20) {
                        await new Promise(function(r) { setTimeout(r, 300); });
                        retries++;
                    }
                    
                    if (typeof window.firebaseUploadProfilePhoto === 'function') {
                        try {
                            console.log('📤 Starting Firebase photo upload for user:', currentUserId);
                            const result = await window.firebaseUploadProfilePhoto(currentUserId, file);
                            console.log('📤 Upload result:', result);
                            if (result.success) {
                                photoStatus.className = 'small text-success mt-2';
                                photoStatus.textContent = '✅ Photo saved successfully!';
                                avatar.style.backgroundImage = `url('${result.photoUrl}')`;
                            } else {
                                photoStatus.className = 'small text-danger mt-2';
                                photoStatus.textContent = '❌ Upload failed: ' + result.message;
                            }
                        } catch (err) {
                            console.error('Photo upload error:', err);
                            photoStatus.className = 'small text-danger mt-2';
                            photoStatus.textContent = '❌ Upload error: ' + err.message;
                        }
                    } else {
                        console.warn('Firebase upload function not available after waiting');
                        photoStatus.className = 'small text-warning mt-2';
                        photoStatus.textContent = '⚠️ Firebase not ready. Preview only.';
                    }
                } else {
                    photoStatus.className = 'small text-warning mt-2';
                    photoStatus.textContent='⚠️ Please login to save photo.';
                }
                uploadBtn.disabled = false;
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

    // Profile form submission - now also updates Firebase
    const profileForm = document.getElementById('profileForm');
    if(profileForm){
        const saveProfileBtn = document.getElementById('saveProfileBtn');
        const profileStatus = document.getElementById('profileStatus');
        profileForm.addEventListener('submit', async function(e){
            e.preventDefault();
            const usernameInput = document.getElementById('Username');
            usernameInput.classList.remove('is-invalid');
            if(!usernameInput.value.trim()){ usernameInput.classList.add('is-invalid'); return; }
            saveProfileBtn.disabled=true; saveProfileBtn.textContent='Saving...';
            
            try {
                const additionalEmails = Array.from(extraEmailsContainer.querySelectorAll('input[data-type="email"]')).map(function(i){ return i.value.trim(); }).filter(function(v){ return v; });
                const additionalPhones = Array.from(extraPhonesContainer.querySelectorAll('input[data-type="phone"]')).map(function(i){ return i.value.trim(); }).filter(function(v){ return v; });
                const payload={
                    Username: usernameInput.value.trim(),
                    FullName: document.getElementById('FullName').value.trim(),
                    PhoneNumber: '',
                    AdditionalEmails: additionalEmails,
                    AdditionalPhones: additionalPhones,
                    BackupEmail: '',
                    EmergencyPhone: ''
                };
                
                let serverSuccess = false;
                let serverMessage = '';
                
                // Try to update server
                try {
                    const tokenEl = document.querySelector('#profileForm input[name="__RequestVerificationToken"]');
                    const token = tokenEl ? tokenEl.value : '';
                    
                    const resp = await fetch('/Home/UpdateProfile', { 
                        method:'POST', 
                        headers:{ 
                            'Content-Type':'application/json',
                            'RequestVerificationToken': token
                        }, 
                        body: JSON.stringify(payload) 
                    });
                    const data = await resp.json();
                    serverSuccess = data.success;
                    serverMessage = data.message || '';
                } catch(serverErr) {
                    console.warn('Server update failed:', serverErr);
                    serverMessage = 'Server unavailable';
                }
                
                // Also update in Firebase if available
                let firebaseSuccess = false;
                if (typeof currentUserId !== 'undefined' && currentUserId && typeof window.firebaseUpdateProfile === 'function') {
                    try {
                        const firebasePayload = {
                            username: payload.Username,
                            fullName: payload.FullName,
                            phoneNumber: payload.PhoneNumber,
                            additionalEmails: additionalEmails,
                            additionalPhones: additionalPhones
                        };
                        const fbResult = await window.firebaseUpdateProfile(currentUserId, firebasePayload);
                        firebaseSuccess = fbResult.success;
                        if (!fbResult.success) {
                            console.warn('Firebase update failed:', fbResult.message);
                        } else {
                            console.log('✅ Profile updated in Firebase');
                        }
                    } catch (fbErr) {
                        console.warn('Firebase update error:', fbErr);
                    }
                }
                
                // Show result
                profileStatus.style.display='block';
                if (serverSuccess || firebaseSuccess) {
                    profileStatus.className = 'alert alert-success';
                    profileStatus.textContent = '✅ Profile updated successfully!';
                    // Update session storage with new values
                    sessionStorage.setItem('Username', payload.Username);
                    sessionStorage.setItem('FullName', payload.FullName);
                } else {
                    profileStatus.className = 'alert alert-danger';
                    profileStatus.textContent = serverMessage || 'Update failed';
                }
                
            } catch(err){ 
                console.error('Profile update error:', err);
                profileStatus.style.display='block'; 
                profileStatus.className='alert alert-danger'; 
                profileStatus.textContent='Error: ' + (err.message||String(err)); 
            }
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
