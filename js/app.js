document.addEventListener('DOMContentLoaded', () => {
    const postInput = document.getElementById('post-input');
    const charCount = document.getElementById('char-count');
    const postBtn = document.getElementById('post-btn');
    const tabs = document.querySelectorAll('.tab-item');

    // 1. 文字数カウンター & 投稿ボタン活性化
    postInput.addEventListener('input', () => {
        const length = postInput.value.length;
        charCount.textContent = `${length} / 500`;

        // 500文字以内かつ1文字以上ならボタンを有効化
        postBtn.disabled = length === 0 || length > 500;
        
        // 超過した時の色変更
        if (length > 500) {
            charCount.classList.add('text-red-500');
        } else {
            charCount.classList.remove('text-red-500');
        }
    });

    // 2. タブ切り替えロジック
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 他のタブのactiveを消して自分に付ける
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 本来はここでAPIを叩いてデータを入れ替える
            const tabName = tab.getAttribute('data-tab');
            document.getElementById('feed').innerHTML = 
                `<div class="p-10 text-center text-gray-400">「${tabName}」のコンテンツを表示準備中...</div>`;
        });
    });
});
