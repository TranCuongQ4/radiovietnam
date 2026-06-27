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

    // ===== Hàm phát radio =====
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

                // Tạo audio element
                const audio = document.createElement('audio');
                audio.id = 'radio-audio-element';
                audio.style.display = 'none';
                document.body.appendChild(audio);
                currentAudio = audio;

                // ===== KIỂM TRA ĐỊNH DẠNG STREAM =====
                const isMP3 = streamUrl.endsWith('.mp3') || streamUrl.includes('.mp3');
                const isHLS = streamUrl.includes('.m3u8') || streamUrl.includes('playlist');

                if (isMP3) {
                    // 📻 Phát MP3 trực tiếp (cho RFI Tiếng Việt)
                    console.log('🎵 Phát MP3 trực tiếp');
                    audio.src = streamUrl;
                    
                    audio.addEventListener('playing', function() {
                        if (btn) {
                            hideLoadingStatus(btn);
                        }
                    });
                    
                    audio.addEventListener('error', function(e) {
                        console.error('Lỗi phát MP3:', e);
                        if (btn) {
                            showLoadingStatus(btn, '⚠️ Lỗi phát!');
                            setTimeout(() => hideLoadingStatus(btn), 2000);
                        }
                    });
                    
                    audio.play().catch(err => {
                        console.warn('Autoplay bị chặn:', err);
                        if (btn) {
                            hideLoadingStatus(btn);
                        }
                    });
                    
                    currentHLS = null;
                    currentAudio = audio;

                } else if (isHLS && Hls.isSupported()) {
                    // 📻 Phát HLS (cho các đài VOV)
                    console.log('📡 Phát HLS');
                    const hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: true,
                    });
                    hls.loadSource(streamUrl);
                    hls.attachMedia(audio);
                    
                    hls.on(Hls.Events.MANIFEST_PARSED, function() {
                        if (btn) {
                            hideLoadingStatus(btn);
                        }
                        audio.play().catch(err => {
                            console.warn('Autoplay bị chặn:', err);
                        });
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
                            }, 2000);
                        }
                    });
                    
                    audio.addEventListener('playing', function() {
                        if (btn) {
                            hideLoadingStatus(btn);
                        }
                    });
                    
                    currentHLS = hls;
                    currentAudio = audio;

                } else if (isHLS && audio.canPlayType('application/vnd.apple.mpegurl')) {
                    // 📻 Safari - phát HLS native
                    console.log('🍎 Safari - phát HLS native');
                    audio.src = streamUrl;
                    audio.addEventListener('playing', function() {
                        if (btn) {
                            hideLoadingStatus(btn);
                        }
                    });
                    audio.play().catch(err => {
                        console.warn('Autoplay bị chặn:', err);
                        if (btn) {
                            hideLoadingStatus(btn);
                        }
                    });
                    currentHLS = null;
                    currentAudio = audio;

                } else {
                    throw new Error('Trình duyệt không hỗ trợ định dạng stream này');
                }

                currentStation = stationSlug;
                isPlaying = true;
            })
            .catch(error => {
                console.error('❌ Lỗi:', error);
                if (btn) {
                    btn.classList.remove('active');
                    showLoadingStatus(btn, '⚠️ Không thể kết nối!');
                    setTimeout(function() {
                        hideLoadingStatus(btn);
                    }, 2000);
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