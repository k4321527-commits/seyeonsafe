// ==================== [수정 후] main.js 핵심 로직 ====================
let coursesDB = []; 

window.addEventListener('DOMContentLoaded', async () => {
    await checkLoginStatus(); 
    await fetchCoursesForMain();
    setupTabs();
});

async function checkLoginStatus() {
    const headerUtils = document.getElementById('headerUtils');
    const adminMenu = document.getElementById('adminMenu');
    const heroLoginBox = document.querySelector('.gov-login-box');

    const { data: { user }, error } = await window.supabase.auth.getUser();

    if (user && !error) {
        const { data: userInfo } = await window.supabase
            .from('users')
            .select('name, role')
            .eq('id', user.id)
            .single();

        let name = userInfo?.name || user.user_metadata?.name || '사용자';
        const role = userInfo?.role || 'user'; 
        const isAdmin = role.includes('admin') || role.includes('관리자') || user.email === 'admin@test.com' || user.email === 'ksbc307@naver.com';

        if (isAdmin) name = '관리자'; 

        if (headerUtils) {
            headerUtils.innerHTML = `
                <span style="font-size:15px; color:#333; font-weight:700;"><b>${name}</b>님 환영합니다</span>
                <a href="#" onclick="logout(event)" style="color:#666; margin-left:15px;"><i class="fa-solid fa-right-from-bracket"></i> 로그아웃</a>
            `;
        }

        if (heroLoginBox) {
            if (isAdmin) {
                if (adminMenu) adminMenu.style.display = 'block';
                heroLoginBox.innerHTML = `
                    <p class="login-desc" style="text-align: center; margin-bottom: 20px; color:#111;">
                        <i class="fa-solid fa-gear" style="font-size:24px; color:#d32f2f; margin-bottom:10px;"></i><br>
                        <strong>관리자 권한</strong>으로 접속 중입니다
                    </p>
                    <button class="btn-gov-login" style="background:#d32f2f;" onclick="location.href='./modules/admin/admin.html'">시스템 관리자 접속</button>
                `;
            } else {
                heroLoginBox.innerHTML = `
                    <p class="login-desc" style="text-align: center; margin-bottom: 20px; color:#111;">
                        <strong>${name}</strong>님, 오늘도 안전한 하루 되세요!
                    </p>
                    <button class="btn-gov-login" onclick="location.href='./modules/mypage/mypage.html'">나의 강의실 바로가기</button>
                `;
            }
        }
    }
}

async function logout(event) {
    if(event) event.preventDefault();
    if (!confirm("정말 로그아웃 하시겠습니까?")) return;
    await window.supabase.auth.signOut();
    alert('안전하게 로그아웃 되었습니다.');
    window.location.reload(); 
}

async function fetchCoursesForMain() {
    const { data, error } = await window.supabase
        .from('courses')
        .select('*')
        .order('id', { ascending: true });

    if (error) return;
    coursesDB = data || [];
    renderVODList('안전보건교육');
}

async function enrollCourse(event, courseId) {
    event.stopPropagation(); 

    const { data: { user }, error: authError } = await window.supabase.auth.getUser();
    if (authError || !user) {
        alert("로그인이 필요한 서비스입니다.");
        window.location.href = "./modules/login/login.html";
        return;
    }

    const targetCourse = coursesDB.find(item => item.id === courseId);
    const courseTitle = targetCourse ? targetCourse.title : '기타 강좌';

    const { data: existing } = await window.supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

    if (existing && existing.length > 0) {
        alert("이미 수강신청된 강의입니다. [나의 강의실]로 이동합니다.");
        window.location.href = "./modules/mypage/mypage.html";
        return;
    }

    const { error: insertError } = await window.supabase
        .from('enrollments')
        .insert([{
            user_id: user.id,          
            course_id: courseId,       
            course_title: courseTitle, 
            status: 'in_progress',     
            progress_rate: 0,
            progress_data: {}
        }]);

    if (insertError) {
        alert("수강신청 중 오류가 발생했습니다: " + insertError.message);
        return;
    }
    
    alert("수강신청이 완료되었습니다. 나의 강의실로 이동합니다.");
    window.location.href = "./modules/mypage/mypage.html";
}

function createCardHTML(item) {
    let thumbStyle = '';
    if (item.thumbnail_url) {
        thumbStyle = `background: url('${item.thumbnail_url}') no-repeat center center; background-size: cover;`;
    } else {
        thumbStyle = `background: #eef2f6;`;
    }

    return `
        <div class="vod-card" onclick="checkEnrollmentAndGo(event, ${item.id})">
            <div class="vod-thumb" style="${thumbStyle}">
                <!-- 💡 연한 흰색(아이보리/은은한 실버톤) 적용 -->
                <i class="fa-solid fa-play" style="${item.thumbnail_url ? 'color: #f1f5f9; text-shadow: 0 2px 6px rgba(0,0,0,0.7); opacity: 0.8;' : 'color: #c4d1e0;'}"></i>
            </div>
            <div class="vod-info">
                <div class="cate">${item.category}</div>
                <div class="title">${item.title}</div>
                <button class="btn-enroll" onclick="enrollCourse(event, ${item.id})">수강신청</button>
            </div>
        </div>
    `;
}

function renderVODList(filterCategory) {
    const container = document.getElementById('vod-grid-container');
    if (!container) return; 
    container.innerHTML = ''; 

    const filteredData = coursesDB.filter(item => item.category === filterCategory);
    
    if (filteredData.length === 0) {
        container.innerHTML = `<p style="grid-column: span 2; text-align:center; color:#666; padding:40px 0;">등록된 강좌가 없습니다.</p>`;
        return;
    }

    filteredData.forEach(item => { container.innerHTML += createCardHTML(item); });
}

function setupTabs() {
    const tabs = document.querySelectorAll('#categoryTabs button');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            const catAttr = e.target.getAttribute('data-category');
            if (catAttr === 'safety') renderVODList('안전보건교육');
            else if (catAttr === 'legal') renderVODList('법정필수교육');
        });
    });
}

// ==================== 🔒 수강신청 여부 검사 및 강의실 입장 ====================
async function checkEnrollmentAndGo(event, courseId) {
    // 하단의 [수강신청] 버튼을 눌렀을 때는 이 함수가 중복 실행되지 않도록 패스
    if (event.target.tagName.toLowerCase() === 'button') return;

    // 1. 로그인 여부 확인
    const { data: { user }, error: authError } = await window.supabase.auth.getUser();
    
    if (authError || !user) {
        alert("강의 수강은 로그인이 필요합니다.");
        window.location.href = "./modules/login/login.html";
        return;
    }

    // 2. 현재 로그인한 유저가 이 강좌(courseId)를 진짜로 신청했는지 DB 조회
    const { data: existing } = await window.supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId);

    // 3. 결과에 따라 입장 or 빠꾸
    if (existing && existing.length > 0) {
        // 수강 내역이 존재하면 강의실로 쿨하게 입장!
        window.location.href = `./modules/classroom/classroom.html?course_id=${courseId}`;
    } else {
        // 수강 내역이 없으면 경고창 띄우기
        alert("수강신청이 되어있지 않습니다.\n하단의 [수강신청] 버튼을 먼저 눌러주세요!");
    }
}