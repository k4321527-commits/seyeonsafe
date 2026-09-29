window.addEventListener('DOMContentLoaded', async () => {
    // 🔒 1. 보안 장치 (Auth Guard): 로그인 안 했으면 홈으로 쫓아내기
    const { data: { user }, error } = await window.supabase.auth.getUser();

    if (error || !user) {
        alert("로그인이 필요한 서비스입니다.");
        window.location.replace('../../index.html'); 
        return; 
    }

    // 💡 2. DB에서 진짜 이름 가져오기 (관리자면 '관리자'로 표기)
    const { data: userInfo } = await window.supabase
        .from('users')
        .select('name, role')
        .eq('id', user.id)
        .single();
    
    const role = userInfo?.role || 'user';
    const isAdmin = role.includes('admin') || role.includes('관리자') || user.email === 'admin@test.com' || user.email === 'ksbc307@naver.com';
    
    const loggedInName = isAdmin ? '관리자' : (userInfo?.name || user.user_metadata?.name || '사용자');
    const nameEl = document.getElementById('headerUserName');
    if (nameEl) nameEl.innerText = loggedInName;

    // 3. URL 파라미터 체크 (메인 화면에서 수강신청 버튼 누르고 왔을 때 탭 이동)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'apply') {
        const applyMenuLink = document.querySelector('.mypage-menu li:first-child a');
        if (applyMenuLink) switchTab('apply', applyMenuLink);
    }

    // 💡 4. [핵심 수정] 마이페이지로 돌아올 때마다 캐시를 무시하고 최신 DB 데이터를 완벽하게 강제 로딩!
    await refreshMyPageData(user.id);
});

// 💡 실시간 데이터 최신화용 래퍼 함수 추가
async function refreshMyPageData(userId) {
    await loadAllCoursesForApply(userId);
    await loadMyEnrollments(userId);
}

// ==================== 탭 전환 함수 ====================
function switchTab(tabId, el) {
    document.querySelectorAll('.mypage-menu a').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
}

function switchApplyTab(paneId, el) {
    const buttons = el.parentElement.querySelectorAll('button');
    buttons.forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.apply-pane').forEach(pane => pane.style.display = 'none');
    document.getElementById(paneId).style.display = 'block';
}

// ==================== 전체 강좌 로딩 및 수강신청 상태 렌더링 ====================
async function loadAllCoursesForApply(userId) {
    // 내가 신청한 내역 가져오기
    const { data: myEnrollments } = await window.supabase
        .from('enrollments')
        .select('course_id, status')
        .eq('user_id', userId);
    
    const enrolledMap = {};
    if (myEnrollments) {
        myEnrollments.forEach(en => enrolledMap[en.course_id] = en.status);
    }

    // 전체 강좌 가져오기
    const { data: courses } = await window.supabase
        .from('courses')
        .select('*')
        .order('id', { ascending: true });
        
    if (!courses) return;

    const safeBody = document.getElementById('safeCourseTableBody');
    const lawBody = document.getElementById('lawCourseTableBody');
    if (safeBody) safeBody.innerHTML = '';
    if (lawBody) lawBody.innerHTML = '';

    courses.forEach(course => {
        let status = enrolledMap[course.id];
        let btnHtml = '';

        if (!status) {
            btnHtml = `<button class="btn btn-outline btn-sm" onclick="applyCourse(${course.id}, '${course.title.replace(/'/g, "\\'")}')">수강신청</button>`;
        } else if (status === 'completed') {
            btnHtml = `<button class="btn btn-outline btn-sm" disabled style="background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; cursor:not-allowed;">수강 완료</button>`;
        } else {
            btnHtml = `
                <div style="display: flex; flex-direction: row; gap: 4px; justify-content: center; align-items: center; white-space: nowrap;">
                    <span style="font-size: 12px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 5px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">학습중</span>
                    <button class="btn btn-outline btn-sm" style="color: #dc2626; border-color: #fca5a5; background: #fff; padding: 5px 8px; font-size: 12px;" onclick="cancelEnrollment(${course.id}, '${course.title.replace(/'/g, "\\'")}')">수강취소</button>
                </div>
            `;
        }

        const rowHtml = `<tr><td>${course.category.replace('교육', '')}</td><td class="text-left">${course.title}</td><td>${btnHtml}</td></tr>`;
        
        if (course.category === '안전보건교육' && safeBody) {
            safeBody.innerHTML += rowHtml;
        } else if (course.category === '법정필수교육' && lawBody) {
            lawBody.innerHTML += rowHtml;
        }
    });
}

// ==================== 수강 신청 실행 ====================
async function applyCourse(courseId, courseTitle) {
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await window.supabase.from('enrollments').insert([{
        user_id: user.id, // 로컬스토리지가 아닌 실제 유저 ID
        course_id: courseId,
        course_title: courseTitle,
        status: 'in_progress',
        progress_rate: 0,
        progress_data: {}
    }]);

    if (error) { 
        alert("수강신청 중 오류가 발생했습니다."); 
        return; 
    }

    alert(`[${courseTitle}] 수강신청이 완료되었습니다!`);
    loadAllCoursesForApply(user.id); 
    loadMyEnrollments(user.id);     
}

// ==================== 수강 취소 실행 ====================
async function cancelEnrollment(courseId, courseTitle) {
    if (!confirm(`[${courseTitle}] 과정을 정말 수강취소 하시겠습니까?`)) return;
    if (!confirm(`[${courseTitle}] 수강신청 내역이 삭제되며 진도율이 초기화됩니다. 취소하시겠습니까?`)) return;

    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) return;

    const { error } = await window.supabase
        .from('enrollments')
        .delete()
        .eq('user_id', user.id)
        .eq('course_id', courseId);
        
    if (error) { 
        alert("수강취소 중 오류가 발생했습니다."); 
        return; 
    }

    alert(`[${courseTitle}] 수강취소가 완료되었습니다.`);
    loadAllCoursesForApply(user.id); 
    loadMyEnrollments(user.id);     
}

// ==================== 내 수강 내역 렌더링 ====================
async function loadMyEnrollments(userId) {
    const { data: enrollments } = await window.supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', userId);
        
    if (!enrollments) return;

    const learningList = enrollments.filter(item => item.status === 'in_progress');
    const completedList = enrollments.filter(item => item.status === 'completed');

    const learningContainer = document.querySelector('#tab-learning');
    if (learningContainer) {
        let cardsHTML = `
            <div class="section-header"><h2>수강 중인 강의</h2></div>
            <div style="background: #f8fafc; border: 1px solid #e1e8f0; border-radius: 8px; padding: 25px; margin-bottom: 30px; display: flex; justify-content: space-around; align-items: center;">
                <div style="text-align: center;">
                    <span style="font-size: 14px; color: #666; font-weight: 700;">학습 진행 중</span>
                    <div style="font-size: 28px; font-weight: 800; color: #0d4a96; margin-top: 5px;">${learningList.length}<span style="font-size: 16px;">건</span></div>
                </div>
                <div style="width: 1px; height: 50px; background-color: #cbd5e1;"></div>
                <div style="text-align: center;">
                    <span style="font-size: 14px; color: #666; font-weight: 700;">수강 완료</span>
                    <div style="font-size: 28px; font-weight: 800; color: #16a34a; margin-top: 5px;">${completedList.length}<span style="font-size: 16px;">건</span></div>
                </div>
            </div>
        `;
        
        if (learningList.length === 0) {
            cardsHTML += `<p style="text-align: center; color: #666; padding: 40px 0;">현재 수강 중인 강의가 없습니다.</p>`;
        } else {
            learningList.forEach(item => {
                let realPercent = item.progress_rate || 0;
                cardsHTML += `
                    <div class="course-card">
                        <div class="course-info">
                            <span class="badge badge-safe">교육과정</span>
                            <h3 class="course-title">${item.course_title}</h3>
                            <p class="course-period">수강 상태: 학습 진행 중</p>
                        </div>
                        <div class="progress-section">
                            <div class="progress-info"><span>진도율</span><span class="progress-percent text-blue">${realPercent}%</span></div>
                            <div class="progress-bar-bg"><div class="progress-bar-fill bg-blue" style="width: ${realPercent}%;"></div></div>
                        </div>
                        <div class="course-action">
                            <button class="btn btn-primary" onclick="location.href='../classroom/classroom.html?course_id=${item.course_id}'">강의실 입장</button>
                        </div>
                    </div>
                `;
            });
        }
        learningContainer.innerHTML = cardsHTML;
    }

    const completedContainer = document.querySelector('#tab-completed');
    if (completedContainer) {
        let completedHTML = `<div class="section-header"><h2>수강 완료 강의</h2></div>`;
        if (completedList.length === 0) {
            completedHTML += `<p style="text-align: center; color: #666; padding: 40px 0;">아직 수강을 완료한 강의가 없습니다.</p>`;
        } else {
            completedList.forEach(item => {
                completedHTML += `
                    <div class="course-card completed">
                        <div class="course-info">
                            <span class="badge badge-safe">교육과정</span>
                            <h3 class="course-title">${item.course_title}</h3>
                            <p class="course-period">수강 상태: 수강 완료</p>
                        </div>
                        <div class="progress-section">
                            <div class="progress-info"><span>진도율</span><span class="progress-percent text-green">100%</span></div>
                            <div class="progress-bar-bg"><div class="progress-bar-fill bg-green" style="width: 100%;"></div></div>
                        </div>
                        <div class="course-action">
                            <button class="btn btn-outline" onclick="window.open('../player/player.html?course_id=${item.course_id}&lesson_num=1', 'LMSPlayer', 'width=1400,height=800,top=100,left=100,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes')">복습하기</button>
                        </div>
                    </div>
                `;
            });
        }
        completedContainer.innerHTML = completedHTML;
    }
}

// ==================== 🚪 로그아웃 함수 ====================
async function handleLogout(event) {
    if(event) event.preventDefault();
    
    if (!confirm("정말 로그아웃 하시겠습니까?")) return;
    
    // 로컬스토리지 삭제 불필요, Supabase 세션만 안전하게 종료
    await window.supabase.auth.signOut();
    
    alert("안전하게 로그아웃 되었습니다.");
    window.location.href = '../../index.html';
}