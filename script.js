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
        'voh-fm': 'voh-fm'
    };

    // ===== WORKER URL CỦA BẠN =====
    const WORKER_URL = 'https://radio.cuongprovui.workers.dev';

    // ===== Lấy tất cả nút radio =====
    const radioButtons = document.querySelectorAll('.radio-btn');

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
            }
            currentStation = null;
        }
        isPlaying = false;
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
        }

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

                // Phát HLS
                if (Hls.isSupported()) {
                    const hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: true,
                    });
                    hls.loadSource(streamUrl);
                    hls.attachMedia(audio);
                    hls.on(Hls.Events.MANIFEST_PARSED, function() {
                        audio.play().catch(err => {
                            console.warn('Autoplay bị chặn:', err);
                        });
                    });
                    hls.on(Hls.Events.ERROR, function(event, data) {
                        if (data.fatal) {
                            console.error('Lỗi HLS:', data);
                            setTimeout(() => {
                                if (currentStation === stationSlug) {
                                    playRadio(stationSlug);
                                }
                            }, 2000);
                        }
                    });
                    currentHLS = hls;
                } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
                    audio.src = streamUrl;
                    audio.play().catch(err => {
                        console.warn('Autoplay bị chặn:', err);
                    });
                } else {
                    throw new Error('Trình duyệt không hỗ trợ HLS');
                }

                currentStation = stationSlug;
                isPlaying = true;
            })
            .catch(error => {
                console.error('❌ Lỗi:', error);
                if (btn) {
                    btn.classList.remove('active');
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