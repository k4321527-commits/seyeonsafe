// =========================================================================
// 스마트 안전관리 교육센터 - 강의실 (100% Supabase DB 연동)
// =========================================================================

window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('course_id');

    if (!courseId) {
        alert("강좌 정보가 없습니다.");
        location.href = '../mypage/mypage.html';
        return;
    }

    const { data: { user }, error: authError } = await window.supabase.auth.getUser();
    if (authError || !user) { alert("로그인이 필요합니다."); location.href = '../../index.html'; return; }
    const userId = user.id;

    // 1. 강좌 정보 불러오기
    const { data: course, error: courseError } = await window.supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

    if (courseError || !course) {
        document.getElementById('courseTitle').innerText = "강좌를 찾을 수 없습니다.";
        return;
    }
    document.getElementById('courseTitle').innerText = course.title;

    // 2. 💡 DB에서 수강 진도 데이터(progress_data) 바로 가져오기! (로컬스토리지 완전 제거)
    const { data: enrollment } = await window.supabase
        .from('enrollments')
        .select('progress_data')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .single();
    
    // DB에 저장된 데이터가 없으면 빈 객체({})를 사용
    let savedData = (enrollment && enrollment.progress_data) ? enrollment.progress_data : {};

    const tbody = document.getElementById('chapterTableBody');
    tbody.innerHTML = '';
    const chapters = course.chapters || [];

    if (chapters.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 40px; color: #666; text-align:center;">등록된 강의 차시가 없습니다.</td></tr>`;
        return;
    }

    let totalCompletedPages = 0;
    const TOTAL_FILES_PER_CHAPTER = 4;
    const totalPossiblePages = chapters.length * TOTAL_FILES_PER_CHAPTER;

    chapters.forEach((ch, idx) => {
        // DB에서 가져온 해당 차시 완료 영상 개수
        let completedPages = savedData[idx] || 0; 
        totalCompletedPages += completedPages; 
        
        let chapterPercent = completedPages * 25; 
        
        const playerLink = `../player/player.html?course_id=${courseId}&lesson_num=${ch.num}`;
        // 플레이어 팝업창 가로 크기 확장 (width=1400)
        const popupOptions = 'width=1400,height=800,top=100,left=100,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes';
        
        let btnText = chapterPercent === 100 ? '복습하기' : '학습하기';
        let btnHtml = `<button class="btn-clean" onclick="window.open('${playerLink}', 'LMSPlayer', '${popupOptions}')">${btnText}</button>`;

        tbody.innerHTML += `
            <tr>
                <td style="color: #6b7280; font-weight: 600;">${String(ch.num).padStart(2, '0')}</td>
                <td>${ch.title}</td>
                <td style="font-weight: 700; color: #0d4a96;">${chapterPercent}%</td>
                <td>${btnHtml}</td>
            </tr>
        `;
    });

    // 전체 진도율 계산 후 화면 상단에 반영
    let overallPercent = totalPossiblePages > 0 ? Math.floor((totalCompletedPages / totalPossiblePages) * 100) : 0;
    const overallEl = document.getElementById('overallProgressText');
    if (overallEl) overallEl.innerText = overallPercent + '%';
});