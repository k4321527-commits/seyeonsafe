// 1. 비밀번호 숨김/보기 (눈알 아이콘) 토글 함수
function togglePassword(inputId, iconEl) {
    const pwdInput = document.getElementById(inputId);
    if (pwdInput.type === "password") {
        pwdInput.type = "text";
        iconEl.classList.remove("fa-eye-slash");
        iconEl.classList.add("fa-eye");
        iconEl.style.color = "#0056b3"; // 볼 때 파란색으로 활성화
    } else {
        pwdInput.type = "password";
        iconEl.classList.remove("fa-eye");
        iconEl.classList.add("fa-eye-slash");
        iconEl.style.color = "#999";
    }
}

// 2. 생년월일 자동 하이픈 (YYYY-MM-DD) 함수
function autoHyphenBirth(target) {
    // 숫자만 남기고 하이픈 제거
    let val = target.value.replace(/[^0-9]/g, '');
    let res = '';
    
    if (val.length < 5) {
        res = val;
    } else if (val.length < 7) {
        res = val.substr(0, 4) + '-' + val.substr(4);
    } else {
        res = val.substr(0, 4) + '-' + val.substr(4, 2) + '-' + val.substr(6, 2);
    }
    target.value = res;
}

// 3. 회원가입 제출 폼 검증
function submitSignup() {
    // 약관 동의 체크
    const agreePrivacy = document.getElementById('agreePrivacy').checked;
    if (!agreePrivacy) {
        alert('개인정보 수집 및 활용에 동의해 주셔야 회원가입이 가능합니다.');
        return;
    }

    // 값 가져오기
    const id = document.getElementById('userId').value.trim();
    const pw = document.getElementById('userPw').value.trim();
    const pwConfirm = document.getElementById('userPwConfirm').value.trim();
    const name = document.getElementById('userName').value.trim();
    const phone1 = document.getElementById('phone1').value.trim();
    const phone2 = document.getElementById('phone2').value.trim();
    const phone3 = document.getElementById('phone3').value.trim();
    const birth = document.getElementById('userBirth').value.trim();
    const rrnFront = document.getElementById('rrnFront').value.trim();
    const rrnBack = document.getElementById('rrnBack').value.trim();

    // 빈칸 검사
    if (!id || !pw || !pwConfirm || !name || !phone1 || !phone2 || !phone3 || !birth || !rrnFront || !rrnBack) {
        alert('모든 회원정보를 빠짐없이 입력해 주세요.');
        return;
    }

    // 비밀번호 일치 검사
    if (pw !== pwConfirm) {
        alert('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
        document.getElementById('userPwConfirm').focus();
        return;
    }

    // 완료 처리
    alert(name + '님, 회원가입이 완료되었습니다!\n로그인 페이지로 이동합니다.');
    location.href = '../login/login.html'; 
}