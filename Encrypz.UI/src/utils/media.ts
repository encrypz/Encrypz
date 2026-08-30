export const generateThumbnailBytes = (file: File): Promise<Uint8Array | null> => {
    return new Promise((resolve) => {
        const processDataUrl = async (dataUrl: string) => {
            try {
                const res = await fetch(dataUrl);
                const buf = await res.arrayBuffer();
                resolve(new Uint8Array(buf));
            } catch {
                resolve(null);
            }
        };

        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;

        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                processDataUrl(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(file);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.onloadeddata = () => {
                video.currentTime = Math.min(1, video.duration / 2 || 0);
            };
            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                let width = video.videoWidth;
                let height = video.videoHeight;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(video, 0, 0, width, height);
                processDataUrl(canvas.toDataURL('image/jpeg', 0.7));
            };
            video.onerror = () => resolve(null);
            video.src = URL.createObjectURL(file);
        } else {
            resolve(null);
        }
    });
};
