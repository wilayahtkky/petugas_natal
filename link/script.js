document.addEventListener("DOMContentLoaded", () => {
    const countElement = document.getElementById("visitor-count");
    
    // Namespace unik untuk halaman PIC Adven
    const namespace = "kumpulan-tkky-pic-adven-2026";
    const key = "kunjungan";

    fetch(`https://api.counterapi.dev/v1/${namespace}/${key}/up`)
        .then(response => {
            if (!response.ok) throw new Error("Gagal mengambil data counter");
            return response.json();
        })
        .then(data => {
            // Format angka dengan pemisah ribuan (contoh: 1.250)
            countElement.textContent = data.count.toLocaleString("id-ID");
        })
        .catch(() => {
            // Fallback ke localStorage jika koneksi API terganggu
            let localCount = parseInt(localStorage.getItem("adven_visitor_count") || "0", 10);
            localCount += 1;
            localStorage.setItem("adven_visitor_count", localCount);
            countElement.textContent = localCount.toLocaleString("id-ID");
        });
});