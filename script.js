(function() {
    'use strict';

    // ===== Ngăn chặn click chuột phải =====
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });

    // ===== Ngăn chặn copy text =====
    document.addEventListener('copy', function(e) {
        e.preventDefault();
        return false;
    });

    // ===== Ngăn chặn cut =====
    document.addEventListener('cut', function(e) {
        e.preventDefault();
        return false;
    });

    // ===== Ngăn chặn paste =====
    document.addEventListener('paste', function(e) {
        e.preventDefault();
        return false;
    });

    // ===== Biến toàn cục =====
    let currentHLS = null;
    let currentAudio = null;
    let currentStation = null;
    let isPlaying = false;

    // ===== Cấu hình API =====
    const STATION_MAP = {
        'vov1': 'vov1',
        'vov2': 'vov2',
        'vov3': 'vov3',
        'vovgt-hcm': 'vovgt-hcm',
        'vovgt-hn': 'vovgt-hn',
        'rfi-tieng-viet': 'rfi-tieng-viet'
    };

    // ===== WORKER URL CỦA BẠN =====
    const WORKER_URL = 'https://radio.cuongprovui.workers.dev';

    // ===== Lấy tất cả nút radio =====
    const radioButtons = document.querySelectorAll('.radio-btn');

    // ===== Hàm hiển thị trạng thái loading =====
    function showLoadingStatus(btn, message) {
        if (!btn) return;
        let statusSpan = btn.querySelector('.station-status');
        if (!statusSpan) {
            statusSpan = document.createElement('span');
            statusSpan.className = 'station-status';
            const nameSpan = btn.querySelector('.station-name');
            if (nameSpan) {
                nameSpan.after(statusSpan);
            } else {
                btn.appendChild(statusSpan);
            }
        }
        statusSpan.textContent = message;
        statusSpan.style.display = 'block';
    }

    // ===== Hàm ẩn trạng thái loading =====
    function hideLoadingStatus(btn) {
        if (!btn) return;
        const statusSpan = btn.querySelector('.station-status');
        if (statusSpan) {
            statusSpan.style.display = 'none';
        }
    }

    // ===== Hàm xóa trạng thái loading khỏi tất cả nút =====
    function clearAllLoadingStatus() {
        document.querySelectorAll('.station-status').forEach(function(el) {
            el.style.display = 'none';
        });
    }

    // ===== Hàm dừng phát hiện tại =====
    function stopCurrentStation() {
        if (currentHLS) {
            try {
                currentHLS.destroy();
            } catch (e) {}
            currentHLS = null;
        }
        if (currentAudio) {
            try {
                currentAudio.pause();
                currentAudio.src = '';
                currentAudio.load();
            } catch (e) {}
            currentAudio = null;
        }
        if (currentStation) {
            const oldBtn = document.querySelector(`.radio-btn[data-station="${currentStation}"]`);
            if (oldBtn) {
                oldBtn.classList.remove('active');
                hideLoadingStatus(oldBtn);
            }
            currentStation = null;
        }
        isPlaying = false;
        clearAllLoadingStatus();
    }

    // ===== Hàm phát MP3 đơn giản (dùng cho RFI) =====
    function playMP3Direct(streamUrl, btn, stationSlug) {
        console.log('🎵 Phát MP3 trực tiếp:', streamUrl);
        
        const audio = document.createElement('audio');
        audio.id = 'radio-audio-element';
        audio.style.display = 'none';
        document.body.appendChild(audio);
        currentAudio = audio;
        audio.src = streamUrl;
        
        // Xử lý sự kiện
        const onCanPlay = function() {
            if (btn) hideLoadingStatus(btn);
            audio.removeEventListener('canplay', onCanPlay);
        };
        const onPlaying = function() {
            if (btn) hideLoadingStatus(btn);
            audio.removeEventListener('playing', onPlaying);
        };
        const onError = function(e) {
            console.error('Lỗi phát MP3:', e);
            if (btn) {
                showLoadingStatus(btn, '⚠️ Lỗi phát!');
                setTimeout(() => hideLoadingStatus(btn), 3000);
            }
            audio.removeEventListener('error', onError);
        };
        
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('playing', onPlaying);
        audio.addEventListener('error', onError);
        
        // Ẩn loading sau 1.5 giây (phòng trường hợp sự kiện không kích hoạt)
        setTimeout(() => {
            if (btn) hideLoadingStatus(btn);
        }, 1500);
        
        audio.play().catch(err => {
            console.warn('Autoplay bị chặn:', err);
            if (btn) hideLoadingStatus(btn);
        });
        
        currentHLS = null;
        currentStation = stationSlug;
        isPlaying = true;
        
        // Lưu lại audio để dừng sau
        currentAudio = audio;
    }

    // ===== Hàm phát HLS (dùng cho VOV) =====
    function playHLS(streamUrl, btn, stationSlug) {
        console.log('📡 Phát HLS:', streamUrl);
        
        const audio = document.createElement('audio');
        audio.id = 'radio-audio-element';
        audio.style.display = 'none';
        document.body.appendChild(audio);
        currentAudio = audio;
        
        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(audio);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                if (btn) hideLoadingStatus(btn);
                audio.play().catch(err => console.warn('Autoplay bị chặn:', err));
            });
            
            hls.on(Hls.Events.ERROR, function(event, data) {
                if (data.fatal) {
                    console.error('Lỗi HLS:', data);
                    if (btn) {
                        showLoadingStatus(btn, '⚠️ Lỗi kết nối...!');
                    }
                    setTimeout(() => {
                        if (currentStation === stationSlug) {
                            playRadio(stationSlug);
                        }
                    }, 3000);
                }
            });
            
            audio.addEventListener('playing', function() {
                if (btn) hideLoadingStatus(btn);
            });
            
            currentHLS = hls;
            
        } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari
            audio.src = streamUrl;
            audio.addEventListener('playing', function() {
                if (btn) hideLoadingStatus(btn);
            });
            audio.play().catch(err => console.warn('Autoplay bị chặn:', err));
            currentHLS = null;
        } else {
            throw new Error('Trình duyệt không hỗ trợ HLS');
        }
        
        currentStation = stationSlug;
        isPlaying = true;
        currentAudio = audio;
    }

    // ===== Hàm phát radio chính =====
    function playRadio(stationSlug) {
        // Nếu đang phát đài này rồi thì dừng
        if (currentStation === stationSlug && isPlaying) {
            stopCurrentStation();
            return;
        }

        // Dừng đài hiện tại
        stopCurrentStation();

        const slug = STATION_MAP[stationSlug];
        if (!slug) {
            console.error('Slug không hợp lệ:', stationSlug);
            return;
        }

        const apiUrl = `${WORKER_URL}/${slug}`;
        const btn = document.querySelector(`.radio-btn[data-station="${stationSlug}"]`);
        
        if (btn) {
            btn.classList.add('active');
            showLoadingStatus(btn, '📻 Đang dò tần số...!');
        }

        document.querySelectorAll('.radio-btn').forEach(function(otherBtn) {
            if (otherBtn !== btn) {
                hideLoadingStatus(otherBtn);
            }
        });

        // ===== ⭐ XỬ LÝ RFI TIẾNG VIỆT ĐẶC BIỆT =====
        // Luôn dùng link MP3 cố định cho RFI, không cần gọi Worker
        if (stationSlug === 'rfi-tieng-viet') {
            const rfiUrl = 'https://rfienvietnamien64k.ice.infomaniak.ch/rfienvietnamien-64.mp3';
            console.log('📻 Phát RFI Tiếng Việt (MP3 cố định)');
            
            // Ẩn loading sau 500ms (cho nó nhanh)
            setTimeout(() => {
                if (btn) hideLoadingStatus(btn);
            }, 500);
            
            playMP3Direct(rfiUrl, btn, stationSlug);
            return;
        }

        // ===== XỬ LÝ CÁC ĐÀI VOV =====
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                let streamUrl = null;
                if (data.url) {
                    streamUrl = data.url;
                } else if (data.streams && data.streams.length > 0) {
                    streamUrl = data.streams[0].url;
                } else if (data.stream) {
                    streamUrl = data.stream;
                }

                if (!streamUrl) {
                    throw new Error('Không tìm thấy link stream');
                }

                console.log('📻 Phát:', data.station || stationSlug);
                console.log('🔗 Link:', streamUrl);
                console.log('📡 Nguồn:', data.source || 'unknown');

                // Phát HLS
                playHLS(streamUrl, btn, stationSlug);
            })
            .catch(error => {
                console.error('❌ Lỗi:', error);
                if (btn) {
                    btn.classList.remove('active');
                    showLoadingStatus(btn, '⚠️ Không thể kết nối!');
                    setTimeout(function() {
                        hideLoadingStatus(btn);
                    }, 3000);
                }
                alert('Không thể phát radio. Vui lòng thử lại!');
            });
    }

    // ===== Xử lý click vào nút =====
    radioButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const station = this.getAttribute('data-station');
            if (station) {
                playRadio(station);
            }
        });

        btn.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
    });

    // ===== Ngăn chặn kéo thả =====
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });

    // ===== Ngăn chặn Ctrl+A =====
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            return false;
        }
    });

    console.log('📻 Radio Việt Nam đã sẵn sàng!');
    console.log('🚀 Worker URL:', WORKER_URL);
})();