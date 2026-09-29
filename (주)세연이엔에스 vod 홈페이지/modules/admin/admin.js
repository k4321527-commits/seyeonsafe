const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltemJma2lueHh1dHdtZ2hqcHBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTUzNjQwOCwiZXhwIjoyMTA1MTEyNDA4fQ.2jIensrG8fwfEUDUd1CwVxxKZCi6w8os6t1IEmdidjo';

let coursesDB = []; 
let currentEditingCourseId = null;
let currentCategoryFilter = '전체'; 
let targetMemberToDelete = null;

let globalEnrollments = []; 
let globalUsersMap = {}; 
let globalUserTextIdMap = {}; 
let isRegistering = false; // 💡 회원등록 중복 클릭 방지

window.addEventListener('DOMContentLoaded', async () => {
    await fetchCoursesFromDB(); 
    updateAssignCourseSelect();
    await loadMembersFromDB(); 
});

// ==================== 1. DB에서 강좌 데이터 불러오기 ====================
async function fetchCoursesFromDB() {
    const { data, error } = await window.supabase
        .from('courses')
        .select('*')
        .order('id', { ascending: true });

    if (error) return;
    if (data && data.length > 0) coursesDB = data;
    renderCourseList();
}

function switchTab(tabId, el) {
    document.querySelectorAll('.admin-menu a').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    
    if(tabId === 'course') renderCourseList();
    if(tabId === 'stats') loadAdminStatistics();
    if(tabId === 'member') loadMembersFromDB(); 
}

function openModal(modalId) { document.getElementById(modalId).classList.add('active'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }

// ==================== 👥 회원 목록 DB 연동 (비밀번호 확인/초기화 기능 포함) ====================
async function loadMembersFromDB() {
    const tbody = document.getElementById('memberTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="padding: 30px; color: #666;">회원 정보를 불러오는 중입니다...</td></tr>';

    const { data: users, error } = await window.supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="color: #e11d48;">데이터를 불러오는데 실패했습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = ''; 

    // 💡 테이블 헤더(th)에 '비밀번호' 칸 동적 보정
    const thead = document.querySelector('.data-table thead tr');
    if (thead && thead.children.length === 5) {
        thead.innerHTML = '<th>회원ID</th><th>사용자명</th><th>비밀번호</th><th>휴대전화</th><th>가입일</th><th>관리</th>';
    }

    if (users && users.length > 0) {
        users.forEach(user => {
            const isAdmin = user.role === 'admin' || user.id === 'admin' || user.user_id === 'admin'; 
            
            const roleBadge = isAdmin 
                ? '<span style="font-weight: 800; color: #e11d48;">최고관리자</span>' 
                : `<span style="font-weight: 700; color: #0d4a96;">${user.name || '이름없음'}</span>`;
            
            // 💡 [핵심] 비밀번호 칸: 최고관리자는 '-', 일반유저는 '확인', '초기화' 버튼 2개 생성
            const passwordArea = isAdmin 
                ? `<span style="color: #94a3b8; font-size: 13px;">-</span>` 
                : `<div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
                       <button class="btn-outline" style="padding: 4px 10px; font-size: 12px; border-radius: 4px;" onclick="verifyAndShowPassword('${user.phone}', '${user.raw_pw}')">확인</button>
                       <button class="btn-outline" style="padding: 4px 10px; font-size: 12px; border-radius: 4px; color: #e11d48; border-color: #fca5a5;" onclick="resetUserPassword('${user.id}', '${user.name}')">초기화</button>
                   </div>`;
            
            const deleteBtn = isAdmin 
                ? '<span style="color: #94a3b8; font-size: 13px; font-weight: 700;">삭제불가</span>' 
                : `<button class="btn-danger" onclick="openDeleteMemberModal('${user.id}', '${user.name}')">삭제</button>`;
            
            const joinDate = user.created_at ? user.created_at.split('T')[0] : '-';
            const phone = user.phone || '-';
            const displayId = user.user_id || (user.id ? user.id.substring(0,8) + '...' : '알수없음');

            tbody.innerHTML += `
                <tr ${isAdmin ? 'style="background-color: #f8fafc;"' : ''}>
                    <td style="font-weight:700; color:#475569;">${displayId}</td>
                    <td>${roleBadge}</td>
                    <td>${passwordArea}</td> <!-- 💡 수정된 버튼 영역 적용 -->
                    <td>${phone}</td>
                    <td>${joinDate}</td>
                    <td>${deleteBtn}</td>
                </tr>
            `;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 30px; color: #666;">등록된 회원이 없습니다.</td></tr>';
    }
}

// ==================== 💡 회원 직접 즉시 삭제 처리 (마스터 키 적용) ====================
async function openDeleteMemberModal(userId, userName) {
    if (!confirm(`[${userName}] 님의 정보를 정말 삭제하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)`)) {
        return;
    }

    try {
        // 마스터키로 Supabase Auth(진짜 로그인 계정)까지 완벽 삭제하여 즉시 재가입 가능하게 만듦!
        const adminClient = window.supabaseLib.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error("Auth 계정 삭제 실패 (이미 지워졌거나 오류):", authDeleteError.message);
        }

        const { error: enError } = await window.supabase.from('enrollments').delete().eq('user_id', userId);
        const { error: userError } = await window.supabase.from('users').delete().eq('id', userId);

        if (userError) {
            alert("회원 삭제 실패: " + userError.message);
            return;
        }

        alert(`[${userName}] 님의 정보가 완벽하게 삭제되었습니다.`);
        await loadMembersFromDB();

    } catch (err) {
        console.error("회원 삭제 중 오류 발생:", err);
        alert("회원 삭제 중 문제가 발생했습니다.");
    }
}

// ==================== 💡 회원 등록 처리 (tempClient 제거 & @lms.com 적용) ====================
async function registerNewMember() {
    if (isRegistering) return; 
    
    const role = document.getElementById('regRole').value;
    const userId = document.getElementById('regId').value.trim();
    const name = document.getElementById('regName').value.trim();
    const pw = document.getElementById('regPw').value;
    const pwConfirm = document.getElementById('regPwConfirm').value;
    
    const p1 = document.getElementById('regPhone1').value.trim();
    const p2 = document.getElementById('regPhone2').value.trim();
    const p3 = document.getElementById('regPhone3').value.trim();
    const birth = document.getElementById('regBirth').value.trim(); 

    if (!userId || !name || !pw) {
        alert('필수 항목(별표*)을 모두 입력해주세요.');
        return;
    }
    if (pw !== pwConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }

    isRegistering = true; 
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) { registerBtn.disabled = true; registerBtn.innerText = '등록 중...'; }

    try {
        const { data: checkDup } = await window.supabase
            .from('users')
            .select('user_id')
            .eq('user_id', userId);

        if (checkDup && checkDup.length > 0) {
            alert(`입력하신 아이디 [${userId}]는 이미 사용 중입니다.`);
            isRegistering = false; 
            if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = '저장 / 등록'; }
            return;
        }

        let phone = null;
        if (p1 && p2 && p3) phone = `${p1}-${p2}-${p3}`;

        // 세연이엔에스 전용 이메일 적용
        const userEmail = `${userId}@lms.com`;

        // 💡 문제의 tempClient를 제거하고 기본 클라이언트(window.supabase)로 깔끔하게 가입 처리
        const { data: authData, error: authError } = await window.supabase.auth.signUp({
            email: userEmail,
            password: pw
        });

        if (authError) {
            alert('인증 시스템 등록 실패: ' + authError.message);
            isRegistering = false; 
            if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = '저장 / 등록'; }
            return;
        }

        const realUuid = authData.user.id;

        const { error: dbError } = await window.supabase
            .from('users')
            .upsert([{
                id: realUuid,       
                user_id: userId,    
                name: name,
                role: role,
                phone: phone,       
                birth: birth || null,
                raw_pw: pw          
            }], { onConflict: ['id'] });

        if (dbError) {
            alert('회원 정보 저장 중 오류가 발생했습니다: ' + dbError.message);
            isRegistering = false; 
            if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = '저장 / 등록'; }
            return;
        }

        alert(`[${name}] 회원이 성공적으로 등록되었습니다!`);
        
        document.getElementById('regId').value = '';
        document.getElementById('regName').value = '';
        document.getElementById('regPw').value = '';
        document.getElementById('regPwConfirm').value = '';
        document.getElementById('regPhone1').value = '';
        document.getElementById('regPhone2').value = '';
        document.getElementById('regPhone3').value = '';
        document.getElementById('regBirth').value = '';

        await loadMembersFromDB();

    } catch (err) {
        alert('알 수 없는 오류가 발생했습니다.');
    } finally {
        isRegistering = false;
        if (registerBtn) { registerBtn.disabled = false; registerBtn.innerText = '저장 / 등록'; }
    }
}

// ==================== 강좌 생성 및 차시 제어 ====================
function filterCourseList(category, btnElement) {
    currentCategoryFilter = category;
    btnElement.parentElement.querySelectorAll('button').forEach(btn => {
        btn.style.background = '#fff'; btn.style.color = '#1e3a8a';
    });
    btnElement.style.background = '#0d4a96'; btnElement.style.color = '#fff';
    renderCourseList(); 
}

function renderCourseList() {
    const tbody = document.getElementById('courseTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let list = currentCategoryFilter !== '전체' ? coursesDB.filter(c => c.category === currentCategoryFilter) : coursesDB;

    list.forEach((course, index) => {
        let badge = `<span style="background: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${course.category}</span>`;
        if (course.category === '안전보건교육') badge = `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${course.category}</span>`;
        if (course.category === '법정필수교육') badge = `<span style="background: #fce7f3; color: #9d174d; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${course.category}</span>`;
        const chapterCount = course.chapters ? course.chapters.length : 0;
        tbody.innerHTML += `
            <tr>
                <td style="color: #94a3b8; font-weight: 700;">${index + 1}</td>
                <td>${badge}</td>
                <td class="text-left"><a class="clickable-link" style="font-size: 15px;" onclick="openCourseDetail(${course.id})">${course.title}</a></td>
                <td style="font-weight: 700; color: ${chapterCount > 0 ? '#16a34a' : '#ef4444'};">${chapterCount}개</td>
                <td><button class="btn-clear-x" onclick="deleteCourse(${course.id}, '${course.title.replace(/'/g, "\\'")}')"><i class="fa-solid fa-xmark"></i></button></td>
            </tr>
        `;
    });
}

async function createNewCourse() {
    const cat = document.getElementById('newCourseCategory').value;
    const title = document.getElementById('newCourseName').value.trim();
    if (!title) { alert("강좌명을 입력해주세요!"); return; }

    const { data, error } = await window.supabase.from('courses').insert([{ category: cat, title: title, chapters: [] }]).select();
    if (error) { alert("강좌 생성 중 오류 발생: " + error.message); return; }
    if (data && data.length > 0) coursesDB.unshift(data[0]);
    
    document.getElementById('newCourseName').value = '';
    renderCourseList();
    alert(`생성 완료! 리스트를 클릭해 차시와 영상 주소를 추가하세요.`);
}

function openCourseDetail(courseId) {
    currentEditingCourseId = courseId;
    document.getElementById('courseListView').style.display = 'none';
    document.getElementById('courseDetailView').style.display = 'block';
    
    const course = coursesDB.find(c => c.id === courseId);
    document.getElementById('detailCourseCategory').innerText = course.category;
    document.getElementById('detailCourseTitle').innerText = course.title;
    
    const container = document.getElementById('chapterListContainer');
    container.innerHTML = '';
    if (course.chapters && course.chapters.length > 0) course.chapters.forEach((ch) => addChapterRow(ch.title, ch.videoUrl));
    else addChapterRow('', '');
}

function closeCourseDetail() {
    document.getElementById('courseDetailView').style.display = 'none';
    document.getElementById('courseListView').style.display = 'block';
    renderCourseList(); 
}

function addChapterRow(savedTitle = '', savedVideoUrl = '') {
    const container = document.getElementById('chapterListContainer');
    const rowCount = container.children.length + 1;
    const rowHtml = `
        <div class="chapter-row" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-weight: 800; color: #0d4a96; width: 60px; text-align: center;">${rowCount}차시</div>
            <input type="text" class="ch-title" value="${savedTitle}" placeholder="차시명 입력 (예: 작업환경 관리)" style="flex: 1.5; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
            <input type="text" class="ch-video" value="${savedVideoUrl}" placeholder="영상 주소 복붙 (예: https://vod.../01.mp4)" style="flex: 2; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;">
            <button class="btn-clear-x" onclick="confirmDeleteChapterRow(this)"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHtml);
}

function confirmDeleteChapterRow(buttonEl) {
    const row = buttonEl.closest('.chapter-row');
    const rowNumText = row.querySelector('div').innerText;
    if (confirm(`${rowNumText}를 정말 삭제하시겠습니까?`)) {
        row.remove();
        document.querySelectorAll('.chapter-row').forEach((r, index) => { r.querySelector('div').innerText = `${index + 1}차시`; });
    }
}

async function saveChapters() {
    const course = coursesDB.find(c => c.id === currentEditingCourseId);
    let newChapters = [];
    document.querySelectorAll('.chapter-row').forEach((row, index) => {
        const title = row.querySelector('.ch-title').value.trim();
        const videoUrl = row.querySelector('.ch-video').value.trim();
        if (title || videoUrl) newChapters.push({ num: index + 1, title: title, videoUrl: videoUrl });
    });

    // 💡 핵심 수정: chapters 뿐만 아니라 course.thumbnail_url(썸네일 주소)도 DB에 함께 업데이트!
    const { error } = await window.supabase
        .from('courses')
        .update({ 
            chapters: newChapters,
            thumbnail_url: course.thumbnail_url || null 
        })
        .eq('id', currentEditingCourseId);

    if (error) {
        alert("저장 중 오류가 발생했습니다: " + error.message);
        return;
    }
    
    course.chapters = newChapters;
    alert('강좌 정보와 썸네일이 성공적으로 저장되었습니다.');
    closeCourseDetail(); 
}

// ==================== 📊 실시간 수강 통계 대시보드 로직 ====================
async function loadAdminStatistics() {
    const statsBody = document.getElementById('adminStatsBody');
    if (!statsBody) return;

    statsBody.innerHTML = '<tr><td colspan="6" style="padding: 40px; color: #64748b;">데이터를 불러오는 중입니다...</td></tr>';

    const [ { data: courses }, { data: enrollments }, { data: users } ] = await Promise.all([
        window.supabase.from('courses').select('id, title, category'),
        window.supabase.from('enrollments').select('*'),
        window.supabase.from('users').select('id, user_id, name') 
    ]);

    globalEnrollments = enrollments || [];
    globalUsersMap = {};
    globalUserTextIdMap = {}; 

    if (users) {
        users.forEach(u => {
            globalUsersMap[u.id] = u.name;
            globalUserTextIdMap[u.id] = u.user_id || u.name; 
        });
    }

    const courseStats = {};
    if (courses) {
        courses.forEach(c => {
            courseStats[c.id] = { title: c.title, category: c.category, total: 0, completed: 0, in_progress: 0, not_started: 0 };
        });
    }

    if (enrollments) {
        enrollments.forEach(en => {
            if (courseStats[en.course_id]) {
                courseStats[en.course_id].total += 1;
                if (en.progress_rate === 100 || en.status === 'completed') {
                    courseStats[en.course_id].completed += 1;
                } else if (en.progress_rate === 0) {
                    courseStats[en.course_id].not_started += 1;
                } else {
                    courseStats[en.course_id].in_progress += 1;
                }
            }
        });
    }

    statsBody.innerHTML = '';
    let hasData = false;
    
    Object.keys(courseStats).forEach(courseId => {
        const stat = courseStats[courseId];
        if (stat.total > 0) {
            hasData = true;
            let badge = `<span style="background: #e2e8f0; color: #475569; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${stat.category}</span>`;
            if (stat.category === '안전보건교육') badge = `<span style="background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${stat.category}</span>`;
            
            statsBody.innerHTML += `
                <tr>
                    <td>${badge}</td>
                    <td class="text-left" style="font-weight: 700; color: #111;">${stat.title}</td>
                    <td><span class="clickable-count" style="color: #1e40af;" onclick="openStatDetail(${courseId}, 'all', '${stat.title.replace(/'/g, "\\'")}')">${stat.total}명</span></td>
                    <td><span class="clickable-count" style="color: #ef4444;" onclick="openStatDetail(${courseId}, 'not_started', '${stat.title.replace(/'/g, "\\'")}')">${stat.not_started}명</span></td>
                    <td><span class="clickable-count" style="color: #f59e0b;" onclick="openStatDetail(${courseId}, 'in_progress', '${stat.title.replace(/'/g, "\\'")}')">${stat.in_progress}명</span></td>
                    <td><span class="clickable-count" style="color: #10b981;" onclick="openStatDetail(${courseId}, 'completed', '${stat.title.replace(/'/g, "\\'")}')">${stat.completed}명</span></td>
                </tr>
            `;
        }
    });

    if (!hasData) {
        statsBody.innerHTML = `<tr><td colspan="6" style="padding: 40px; color: #64748b;">아직 수강 신청 내역이 없습니다.</td></tr>`;
    }
}

function openStatDetail(courseId, filterType, courseTitle) {
    const tbody = document.getElementById('drilldownTableBody');
    const titleEl = document.getElementById('drilldownModalTitle');
    tbody.innerHTML = '';
    
    let typeText = '전체 명단';
    if(filterType === 'not_started') typeText = '미수강 명단';
    if(filterType === 'in_progress') typeText = '학습 중 명단';
    if(filterType === 'completed') typeText = '수강 완료 명단';
    
    titleEl.innerHTML = `<span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 4px;">${courseTitle}</span>${typeText}`;

    const filteredUsers = globalEnrollments.filter(en => {
        if (en.course_id !== courseId) return false;
        if (filterType === 'not_started') return en.progress_rate === 0 && en.status !== 'completed';
        if (filterType === 'in_progress') return en.progress_rate > 0 && en.progress_rate < 100;
        if (filterType === 'completed') return en.progress_rate === 100 || en.status === 'completed';
        return true; 
    });

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 30px; color: #666;">해당 조건의 수강생이 없습니다.</td></tr>`;
    } else {
        filteredUsers.forEach(en => {
            const userName = globalUsersMap[en.user_id] || '이름없음';
            let displayId = globalUserTextIdMap[en.user_id] || en.user_id.substring(0, 8);
            
            let statusBadge = `<span style="background: #fef3c7; color: #d97706; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">학습 중</span>`;
            let progressColor = '#0d4a96';
            if (en.progress_rate === 100 || en.status === 'completed') {
                statusBadge = `<span style="background: #dcfce7; color: #16a34a; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">수강완료</span>`;
                progressColor = '#16a34a';
            } else if (en.progress_rate === 0) {
                statusBadge = `<span style="background: #fee2e2; color: #ef4444; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">미수강</span>`;
                progressColor = '#ef4444';
            }

            tbody.innerHTML += `
                <tr>
                    <td style="color: #64748b; font-weight: 600;">${displayId}</td>
                    <td style="font-weight: 700; color: #111;">${userName}</td>
                    <td>${statusBadge}</td>
                    <td style="font-weight: 800; color: ${progressColor};">${en.progress_rate}%</td>
                </tr>
            `;
        });
    }
    
    openModal('enrollDrilldownModal');
}

async function deleteCourse(courseId, courseTitle) {
    if (!confirm(`[${courseTitle}] 강좌를 정말 삭제하시겠습니까?\n(등록된 차시 영상 정보도 모두 함께 삭제됩니다.)`)) {
        return;
    }

    const { error } = await window.supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

    if (error) {
        alert('강좌 삭제 중 오류가 발생했습니다: ' + error.message);
        return;
    }

    coursesDB = coursesDB.filter(c => c.id !== courseId);
    alert(`[${courseTitle}] 강좌가 성공적으로 삭제되었습니다.`);
    renderCourseList();
}

// ==================== 🚪 관리자 페이지 로그아웃 기능 ====================
async function handleLogout(event) {
    if(event) event.preventDefault();
    if (!confirm("정말 로그아웃 하시겠습니까?")) return;
    
    await window.supabase.auth.signOut();
    alert('안전하게 로그아웃 되었습니다.');
    window.location.href = '../../index.html';
}

// ==================== 📚 수강 등록 탭: 분류별 강좌 목록 자동 채우기 ====================
async function updateAssignCourseSelect() {
    const categorySelect = document.getElementById('assignCategorySelect');
    const courseSelect = document.getElementById('assignCourseSelect');
    
    if (!categorySelect || !courseSelect) return;

    const selectedCategory = categorySelect.value;
    courseSelect.innerHTML = '<option value="">-- 강좌를 선택하세요 --</option>';

    if (!selectedCategory) return;

    const { data: courses, error } = await window.supabase
        .from('courses')
        .select('id, title, category')
        .eq('category', selectedCategory)
        .order('id', { ascending: true });

    if (error) {
        console.error("강좌 목록 불러오기 실패:", error);
        return;
    }

    if (courses && courses.length > 0) {
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id; 
            option.textContent = course.title; 
            courseSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "-- 등록된 강좌가 없습니다 --";
        courseSelect.appendChild(option);
    }
}

// ==================== 📖 체크박스 다중 선택 회원 명단 렌더링 ====================
let currentMemberPage = 1;
const membersPerPage = 20;
let cachedMembersList = []; 

async function openMemberListModal() {
    currentMemberPage = 1; 
    const modalEl = document.getElementById('memberListModal');
    if (modalEl) openModal('memberListModal');

    await fetchAndRenderMemberList();
}

async function fetchAndRenderMemberList() {
    const tbody = document.getElementById('memberListTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="padding: 30px; text-align: center; color: #666;">회원 명단을 불러오는 중입니다...</td></tr>';
    
    const { data: users, error } = await window.supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 30px; text-align: center; color: #e11d48;">회원 명단을 불러오는데 실패했습니다.</td></tr>';
        return;
    }

    cachedMembersList = users || [];
    renderMemberPage();
}

function renderMemberPage() {
    const tbody = document.getElementById('memberListTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (cachedMembersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding: 30px; text-align: center; color: #666;">등록된 회원이 없습니다.</td></tr>';
        removePaginationUI();
        return;
    }

    const totalPages = Math.ceil(cachedMembersList.length / membersPerPage);
    if (currentMemberPage > totalPages) currentMemberPage = totalPages;
    if (currentMemberPage < 1) currentMemberPage = 1;

    const startIndex = (currentMemberPage - 1) * membersPerPage;
    const endIndex = startIndex + membersPerPage;
    const currentSlice = cachedMembersList.slice(startIndex, endIndex);

    currentSlice.forEach(user => {
        const displayId = user.user_id || user.id || '아이디없음';
        const name = user.name || '이름없음';
        const birth = (user.birth && user.birth.trim() !== '') ? user.birth : '-';
        const phone = (user.phone && user.phone.trim() !== '') ? user.phone : '-';

        tbody.innerHTML += `
            <tr>
                <td><input type="checkbox" class="member-checkbox" value="${displayId}" onchange="updateSelectedCount()"></td>
                <td style="font-weight: 700; color: #0d4a96;">${displayId}</td>
                <td>${name}</td>
                <td>${birth}</td>
                <td>${phone}</td>
            </tr>
        `;
    });

    renderPaginationUI(totalPages);
    updateSelectedCount();
}

function toggleAllMembers(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.member-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkedCount = document.querySelectorAll('.member-checkbox:checked').length;
    const countTextEl = document.getElementById('selectedCountText');
    if (countTextEl) {
        countTextEl.innerText = `선택된 회원: ${checkedCount}명`;
    }
}

function applySelectedMembersToInput() {
    const checkedCheckboxes = document.querySelectorAll('.member-checkbox:checked');
    if (checkedCheckboxes.length === 0) {
        alert("선택된 회원이 없습니다. 등록할 회원의 체크박스를 선택해주세요.");
        return;
    }

    const selectedIds = Array.from(checkedCheckboxes).map(cb => cb.value);
    const inputEl = document.getElementById('assignUserIds');

    if (inputEl) {
        let existingVal = inputEl.value.trim();
        if (existingVal) {
            let existingArr = existingVal.split(',').map(s => s.trim());
            let combined = Array.from(new Set([...existingArr, ...selectedIds]));
            inputEl.value = combined.join(', ');
        } else {
            inputEl.value = selectedIds.join(', ');
        }
    }

    closeModal('memberListModal');
}

function renderPaginationUI(totalPages) {
    let paginationContainer = document.getElementById('memberPaginationContainer');
    
    if (!paginationContainer) {
        const modalContent = document.querySelector('#memberListModal .modal-content');
        if (modalContent) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'memberPaginationContainer';
            paginationContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px;';
            modalContent.appendChild(paginationContainer);
        }
    }

    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = `
        <button class="btn btn-outline btn-sm" onclick="changeMemberPage(${currentMemberPage - 1})" ${currentMemberPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>이전</button>
    `;

    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentMemberPage;
        html += `
            <button class="btn ${isActive ? 'btn-primary' : 'btn-outline'} btn-sm" style="padding: 4px 10px; min-width: 30px;" onclick="changeMemberPage(${i})">${i}</button>
        `;
    }

    html += `
        <button class="btn btn-outline btn-sm" onclick="changeMemberPage(${currentMemberPage + 1})" ${currentMemberPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>다음</button>
    `;

    paginationContainer.innerHTML = html;
}

function changeMemberPage(targetPage) {
    const totalPages = Math.ceil(cachedMembersList.length / membersPerPage);
    if (targetPage < 1 || targetPage > totalPages) return;
    currentMemberPage = targetPage;
    renderMemberPage();
}

function removePaginationUI() {
    const paginationContainer = document.getElementById('memberPaginationContainer');
    if (paginationContainer) paginationContainer.innerHTML = '';
}

async function assignCourseToUsers() {
    const courseSelect = document.getElementById('assignCourseSelect');
    const userInputEl = document.getElementById('assignUserIds');

    const courseId = courseSelect.value;
    const userInputText = userInputEl.value.trim();

    if (!courseId) {
        alert("할당할 강좌를 먼저 선택해주세요.");
        return;
    }
    if (!userInputText) {
        alert("수강생 아이디를 입력하거나 [회원 명단]에서 선택해주세요.");
        return;
    }

    const selectedCourseOption = courseSelect.options[courseSelect.selectedIndex];
    const courseTitle = selectedCourseOption ? selectedCourseOption.text : '교육과정';

    const userIds = userInputText.split(',').map(id => id.trim()).filter(id => id !== '');

    let successCount = 0;
    let failCount = 0;

    for (const targetUserId of userIds) {
        const { data: userRecord, error: userError } = await window.supabase
            .from('users')
            .select('id, user_id, name')
            .eq('user_id', targetUserId)
            .single();

        if (userError || !userRecord) {
            console.warn(`아이디 [${targetUserId}]를 찾을 수 없습니다.`);
            failCount++;
            continue;
        }

        const realUuid = userRecord.id; 

        const { data: existing } = await window.supabase
            .from('enrollments')
            .select('*')
            .eq('user_id', realUuid)
            .eq('course_id', courseId);

        if (existing && existing.length > 0) {
            console.log(`[${targetUserId}] 님은 이미 해당 강좌가 등록되어 있습니다.`);
            failCount++;
            continue;
        }

        const { error: insertError } = await window.supabase
            .from('enrollments')
            .insert([{
                user_id: realUuid,          
                course_id: Number(courseId), 
                course_title: courseTitle,  
                status: 'in_progress',      
                progress_rate: 0,           
                progress_data: {}           
            }]);

        if (insertError) {
            console.error(`[${targetUserId}] 수강 등록 실패:`, insertError.message);
            failCount++;
        } else {
            successCount++;
        }
    }

    if (successCount > 0) {
        alert(`총 ${successCount}명의 수강생에게 강좌가 성공적으로 등록되었습니다!`);
        userInputEl.value = ''; 
    } else {
        alert(`수강 등록에 실패했습니다. (이미 등록된 회원 이거나 존재하지 않는 아이디인지 확인해주세요.)`);
    }
}

// ==================== 💡 추가기능 1: 휴대폰 번호 검증 후 비밀번호 열람 ====================
window.verifyAndShowPassword = function(userPhone, rawPw) {
    if (!rawPw || rawPw === 'undefined' || rawPw === 'null') {
        alert('저장된 평문 비밀번호가 없습니다. [초기화] 버튼을 눌러주세요.');
        return;
    }
    if (!userPhone || userPhone === '-' || userPhone === 'undefined' || userPhone === 'null') {
        alert('해당 회원은 등록된 휴대폰 번호가 없어 확인이 불가능합니다. [초기화]를 진행해주세요.');
        return;
    }

    // 관리자에게 휴대폰 번호 입력 팝업 띄우기
    const inputPhone = prompt('보안 확인: 해당 회원의 가입된 휴대폰 번호를 입력해주세요.\n(하이픈(-) 포함 정확히 입력)');
    
    if (inputPhone === null) return; // 취소 누름
    
    if (inputPhone.trim() === userPhone) {
        alert(`✅ 인증 성공!\n해당 회원의 비밀번호는 [ ${rawPw} ] 입니다.`);
    } else {
        alert('❌ 입력하신 휴대폰 번호가 등록된 정보와 일치하지 않습니다.');
    }
};

// ==================== 💡 추가기능 2: 비밀번호 '123456' 강제 초기화 ====================
window.resetUserPassword = async function(userId, userName) {
    if (!confirm(`[${userName}] 님의 비밀번호를 초기 비밀번호인 '123456'으로 초기화 하시겠습니까?`)) {
        return;
    }

    try {
        // 1. Supabase Auth 계정 비밀번호 강제 변경 (마스터 키 활용)
        const adminClient = window.supabaseLib.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
            password: '123456'
        });

        if (authError) {
            console.error("Auth 비밀번호 초기화 실패:", authError.message);
            alert("인증 시스템 비밀번호 초기화 중 오류가 발생했습니다.");
            return;
        }

        // 2. 표에 보여주기 위해 users DB의 raw_pw 값도 123456으로 업데이트
        const { error: dbError } = await window.supabase
            .from('users')
            .update({ raw_pw: '123456' })
            .eq('id', userId);

        if (dbError) {
            alert("DB 비밀번호 갱신 중 오류가 발생했습니다.");
            return;
        }

        alert(`✅ [${userName}] 님의 비밀번호가 '123456'으로 성공적으로 초기화되었습니다.`);
        await loadMembersFromDB(); // 표 새로고침

    } catch (err) {
        console.error("초기화 중 예외 발생:", err);
        alert("비밀번호 초기화 중 문제가 발생했습니다.");
    }
};

// ==================== 🖼️ 썸네일 드래그앤드롭 및 업로드 로직 ====================
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('thumbnailFile');
    
    if (!dropZone || !fileInput) return;

    // 드래그 중 기본 효과 방지
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // 드래그 진입 시 시각적 효과
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.borderColor = '#0d4a96';
            dropZone.style.background = '#eff6ff';
        }, false);
    });

    // 드래그 이탈 시 원상복구
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.borderColor = '#cbd5e1';
            dropZone.style.background = '#f8fafc';
        }, false);
    });

    // 파일 드롭 시 처리
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleThumbnailFile(files[0]);
        }
    });

    // 클릭해서 파일 선택 시 처리
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleThumbnailFile(e.target.files[0]);
        }
    });
});

// 이미지 파일 업로드 및 Supabase 스토리지 연동 함수
async function handleThumbnailFile(file) {
    if (!file.type.startsWith('image/')) {
        alert("이미지 파일(.png, .jpg 등)만 업로드 가능합니다.");
        return;
    }

    // 파일 이름 중복 방지를 위한 타임스탬프 결합
    const fileExt = file.name.split('.').pop();
    const fileName = `thumb_${Date.now()}.${fileExt}`;
    const filePath = `thumbnails/${fileName}`;

    // 💡 Supabase 스토리지(bucket 이름을 'thumbnails'로 생성해 두어야 합니다)에 업로드
    const { data, error } = await window.supabase.storage
        .from('thumbnails')
        .upload(filePath, file);

    if (error) {
        alert("이미지 업로드 실패: " + error.message + "\n(Supabase 스토리지에 'thumbnails' 버킷이 공개(Public)로 생성되어 있는지 확인해주세요.)");
        return;
    }

    // 업로드된 파일의 공인 URL 가져오기
    const { data: publicURLData } = window.supabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath);

    const publicUrl = publicURLData.publicUrl;

    // 현재 편집 중인 강좌 데이터 객체에 썸네일 주소 임시 저장
    const course = coursesDB.find(c => c.id === currentEditingCourseId);
    if (course) {
        course.thumbnail_url = publicUrl;
    }

    // 미리보기 화면 갱신
    showThumbnailPreview(publicUrl);
    alert("썸네일 이미지가 성공적으로 업로드되었습니다!");
}

function showThumbnailPreview(url) {
    const previewWrap = document.getElementById('thumbPreviewWrap');
    const previewImg = document.getElementById('thumbPreviewImg');
    const dropZone = document.getElementById('dropZone');

    if (previewWrap && previewImg) {
        previewImg.src = url;
        previewWrap.style.display = 'flex';
        if (dropZone) dropZone.style.display = 'none'; // 업로드 후엔 드롭존을 숨기고 미리보기 표시
    }
}

function removeThumbnail() {
    const course = coursesDB.find(c => c.id === currentEditingCourseId);
    if (course) {
        course.thumbnail_url = '';
    }

    const previewWrap = document.getElementById('thumbPreviewWrap');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('thumbnailFile');

    if (previewWrap) previewWrap.style.display = 'none';
    if (dropZone) dropZone.style.display = 'block';
    if (fileInput) fileInput.value = '';
}

// 기존 openCourseDetail 함수에 썸네일 미리보기를 띄워주는 로직 연동
const originalOpenCourseDetail = window.openCourseDetail;
window.openCourseDetail = function(courseId) {
    if (originalOpenCourseDetail) originalOpenCourseDetail(courseId);

    const course = coursesDB.find(c => c.id === courseId);
    if (course && course.thumbnail_url) {
        showThumbnailPreview(course.thumbnail_url);
    } else {
        removeThumbnail();
    }
};