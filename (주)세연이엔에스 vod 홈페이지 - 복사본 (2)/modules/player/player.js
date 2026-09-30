// =========================================================================
// 💡 스마트 안전관리 교육센터 - 1차시당 4개 파일(01~04) 체제 완벽 복원 플레이어
// =========================================================================
const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('course_id');
let lessonNum = parseInt(urlParams.get('lesson_num')) || 1;

const TOTAL_PAGES_PER_LESSON = 4; // 💡 1차시당 세부 파일 4개 (01, 02, 03, 04) 복원!
let currentPageIdx = 0; 

let currentCourseInfo = null;
let currentChapter = null;
let currentChapterIdx = 0;

let maxWatchedTimes = {}; 
let myProgressData = {}; // DB 진도 데이터 임시 저장용 메모리 (차시별 완료된 파일 개수 저장)
let currentUserId = 'test_user';

window.addEventListener('DOMContentLoaded', async () => {
    if (!courseId) { alert("잘못된 접근입니다."); window.close(); return; }

    const { data: { user }, error: authError } = await window.supabase.auth.getUser();
    if (authError || !user) { alert("로그인이 필요합니다."); window.close(); return; }
    currentUserId = user.id;

    const { data: course } = await window.supabase.from('courses').select('*').eq('id', courseId).single();
    if (!course || !course.chapters) { alert("강좌 정보를 불러오지 못했습니다."); return; }
    currentCourseInfo = course;

    // 1. 플레이어 시작 시 DB에서 기존 진도 데이터(progress_data) 가져오기
    const { data: en } = await window.supabase
        .from('enrollments')
        .select('progress_data')
        .eq('user_id', currentUserId)
        .eq('course_id', courseId)
        .single();
        
    if (en && en.progress_data) {
        myProgressData = en.progress_data;

        // DB에 기록된 차시별 완료 파일 개수(0~4)를 바탕으로 시청 상태 복원
        Object.keys(myProgressData).forEach(chIdx => {
            let completedCount = myProgressData[chIdx];
            for (let p = 0; p < completedCount; p++) {
                maxWatchedTimes[`${chIdx}-${p}`] = 99999; // 이미 들었던 세부 파일은 완료 처리
            }
        });
    }

    currentChapterIdx = currentCourseInfo.chapters.findIndex(ch => Number(ch.num) === Number(lessonNum));
    if (currentChapterIdx === -1) currentChapterIdx = 0;

    loadPlayerState();
    setupAntiSkip();
});

function loadPlayerState() {
    currentChapter = currentCourseInfo.chapters[currentChapterIdx];
    document.getElementById('courseTitleDisplay').innerText = currentCourseInfo.title;
    document.getElementById('currentLessonNum').innerText = currentChapter.num;
    document.getElementById('totalLessonCount').innerText = currentCourseInfo.chapters.length;
    document.getElementById('pageIndicator').innerText = `0${currentPageIdx + 1} / 0${TOTAL_PAGES_PER_LESSON}`;
    
    // 차시별 기본 주소에서 파일 번호(01.mp4 ~ 04.mp4) 조합
    let rawUrl = currentChapter.videoUrl || "https://vod.kscenter.co.kr/kscontents/420/001/01.mp4";
    let baseDir = rawUrl.substring(0, rawUrl.lastIndexOf('/')); 
    const videoUrl = `${baseDir}/${String(currentPageIdx + 1).padStart(2, '0')}.mp4`;
    
    const videoEl = document.getElementById('videoPlayer');
    document.getElementById('videoSource').src = videoUrl;
    videoEl.load();
    renderSidebar();
}

const video = document.getElementById('videoPlayer');

function setupAntiSkip() {
    let lastValidTime = 0;
    video.addEventListener('timeupdate', () => {
        const videoKey = `${currentChapterIdx}-${currentPageIdx}`;
        if (!maxWatchedTimes[videoKey]) maxWatchedTimes[videoKey] = 0;
        
        if (video.currentTime > maxWatchedTimes[videoKey]) {
            if (video.currentTime - lastValidTime > 1.5) { 
                video.currentTime = maxWatchedTimes[videoKey]; 
                return; 
            }
            maxWatchedTimes[videoKey] = video.currentTime;
        }
        lastValidTime = video.currentTime;
    });

    video.addEventListener('seeking', () => {
        const videoKey = `${currentChapterIdx}-${currentPageIdx}`;
        const maxAllowed = maxWatchedTimes[videoKey] || 0;
        if (video.currentTime > maxAllowed + 1 && maxAllowed < 99999) {
            video.currentTime = maxAllowed;
        }
    });

    // 영상 재생 종료 시 현재 세부 파일 완료 처리
    video.addEventListener('ended', () => { 
        maxWatchedTimes[`${currentChapterIdx}-${currentPageIdx}`] = 99999;
        updateProgressDataInMemory(); 
    });
}

function isCurrentVideoCompleted() {
    const videoKey = `${currentChapterIdx}-${currentPageIdx}`;
    const watched = maxWatchedTimes[videoKey] || 0;
    return video.ended || watched >= 99999 || (video.duration && video.currentTime >= video.duration - 2);
}

// 💡 4개 파일 체제용 다음/이전 이동 함수 (01 -> 02 -> 03 -> 04 -> 다음 차시 01)
function moveChapter(direction) {
    if (direction === 1) {
        if (!isCurrentVideoCompleted()) { 
            alert("현재 영상을 끝까지 시청해야 다음으로 넘어갈 수 있습니다!"); 
            return; 
        }
        
        // 같은 차시 안에서 다음 세부 파일로 이동 (예: 01 -> 02)
        if (currentPageIdx < TOTAL_PAGES_PER_LESSON - 1) { 
            currentPageIdx++; 
            loadPlayerState(); 
            return; 
        }
        
        // 마지막 파일(04)까지 끝났으면 다음 차시의 첫 번째 파일(01)로 이동
        if (currentChapterIdx + 1 < currentCourseInfo.chapters.length) { 
            currentChapterIdx++; 
            currentPageIdx = 0; 
            lessonNum = currentCourseInfo.chapters[currentChapterIdx].num;
            loadPlayerState(); 
        } else { 
            alert("마지막 강의입니다."); 
        }
    } else if (direction === -1) {
        if (currentPageIdx > 0) { 
            currentPageIdx--; 
            loadPlayerState(); 
            return; 
        }
        if (currentChapterIdx - 1 >= 0) { 
            currentChapterIdx--; 
            currentPageIdx = TOTAL_PAGES_PER_LESSON - 1; 
            lessonNum = currentCourseInfo.chapters[currentChapterIdx].num;
            loadPlayerState(); 
        } else { 
            alert("첫 번째 강의입니다."); 
        }
    }
}

// 💡 현재 차시에서 완료한 세부 파일 개수를 메모리에 누적 저장
function updateProgressDataInMemory() {
    if (!myProgressData[currentChapterIdx]) myProgressData[currentChapterIdx] = 0;
    
    // 현재 페이지가 이미 완료 상태이거나 끝까지 보았으면 해당 개수 반영
    let isDone = isCurrentVideoCompleted();
    if (isDone && currentPageIdx + 1 > myProgressData[currentChapterIdx]) {
        myProgressData[currentChapterIdx] = currentPageIdx + 1;
    }
    renderSidebar();
}

function renderSidebar() {
    const container = document.getElementById('chapterListContainer');
    container.innerHTML = '';
    currentCourseInfo.chapters.forEach((ch, idx) => {
        let completedPages = myProgressData[idx] || 0;
        let isDone = completedPages >= TOTAL_PAGES_PER_LESSON;
        let isActive = idx === currentChapterIdx ? 'active' : '';
        let statusClass = isDone ? 'completed' : (idx === currentChapterIdx ? 'in-progress' : 'not-started');
        let statusText = isDone ? '학습완료' : (idx === currentChapterIdx ? `학습중 (P.${currentPageIdx + 1}/${TOTAL_PAGES_PER_LESSON})` : '학습안함');
        
        container.innerHTML += `
            <div class="chapter-item ${isActive} ${statusClass}" onclick="if(${idx} <= currentChapterIdx || ${isDone}) { currentChapterIdx = ${idx}; currentPageIdx = 0; lessonNum = ${ch.num}; loadPlayerState(); } else { alert('이전 차시를 먼저 완료해주세요.'); }">
                <div class="title">${ch.num}차시. ${ch.title}</div>
                <div class="status"><i class="fa-solid fa-circle-dot"></i> ${statusText}</div>
            </div>
        `;
    });
}

// ==================== 🛠️ 전체 진도율 정밀 계산 및 DB 실시간 연동 ====================
let updateTimer = null; 

video.addEventListener('timeupdate', async () => {
    if (!video.duration) return;
    
    let currentVideoPercent = (video.currentTime / video.duration) * 100;
    if (video.ended || currentVideoPercent >= 98) {
        currentVideoPercent = 100;
        maxWatchedTimes[`${currentChapterIdx}-${currentPageIdx}`] = 99999;
        updateProgressDataInMemory(); 
    }

    // 현재 세부 파일의 진행도 표시
    let lessonDisplayPercent = Math.floor(currentVideoPercent);
    document.getElementById('lessonProgressBar').style.width = lessonDisplayPercent + '%';
    document.getElementById('lessonProgressText').innerText = lessonDisplayPercent + '%'; 
    
    // 전체 진도율 계산 (전체 차시 수 × 4개 파일 기준)
    const totalChapters = currentCourseInfo.chapters.length; 
    const totalFiles = totalChapters * TOTAL_PAGES_PER_LESSON;
    if (totalFiles === 0) return;

    let completedFilesCount = 0;
    for (let i = 0; i < totalChapters; i++) {
        let savedCount = myProgressData[i] || 0;
        if (i === currentChapterIdx) {
            // 현재 차시에서 완료한 파일 수 + 현재 파일의 재생 비율(0~1 사이)
            let curFileProgress = currentVideoPercent / 100;
            completedFilesCount += Math.max(savedCount, currentPageIdx + curFileProgress);
        } else {
            completedFilesCount += savedCount;
        }
    }

    const overallPercent = Math.min(100, Math.floor((completedFilesCount / totalFiles) * 100));
    
    const totalProgressEl = document.getElementById('totalProgressText');
    if (totalProgressEl) totalProgressEl.innerText = overallPercent + '%'; 

    // 5초에 한 번씩 DB에 자동 저장
    if (!updateTimer) {
        updateTimer = setTimeout(async () => {
            updateProgressDataInMemory(); 
            
            await window.supabase.from('enrollments').update({ 
                progress_rate: overallPercent, 
                status: overallPercent === 100 ? 'completed' : 'in_progress',
                progress_data: myProgressData 
            }).eq('user_id', currentUserId).eq('course_id', courseId);
            
            updateTimer = null;
        }, 5000); 
    }
});

video.addEventListener('ended', async () => {
    maxWatchedTimes[`${currentChapterIdx}-${currentPageIdx}`] = 99999;
    updateProgressDataInMemory();
    
    const totalChapters = currentCourseInfo.chapters.length;
    const totalFiles = totalChapters * TOTAL_PAGES_PER_LESSON;
    let completedFilesCount = 0;
    for (let i = 0; i < totalChapters; i++) {
        completedFilesCount += (myProgressData[i] || 0);
    }
    const finalOverallPercent = Math.min(100, Math.floor((completedFilesCount / totalFiles) * 100));

    await window.supabase.from('enrollments').update({ 
        progress_rate: finalOverallPercent, 
        status: finalOverallPercent === 100 ? 'completed' : 'in_progress',
        progress_data: myProgressData 
    }).eq('user_id', currentUserId).eq('course_id', courseId);
});