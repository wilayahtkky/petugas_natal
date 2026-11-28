document.addEventListener("DOMContentLoaded", () => {
    const countElement = document.getElementById("visitor-count");
    const hostname = window.location.hostname;

    // Deteksi environment: abaikan hitungan jika dibuka secara lokal (testing)
    const isProduction =
        hostname !== "localhost" &&
        hostname !== "127.0.0.1" &&
        window.location.protocol !== "file:";

    if (!isProduction) {
        countElement.textContent = "0 (Mode Uji Coba)";
        return;
    }

    // Namespace dan key unik untuk fase production
    const namespace = "kumpulan-tkky-pic-adven-2026";
    const key = "kunjungan";

    // Menggunakan Abacus API (tanpa perlu daftar akun/workspace)
    fetch(`https://abacus.jasoncameron.dev/hit/${namespace}/${key}`)
        .then(response => {
            if (!response.ok) throw new Error("Gagal mengambil data counter");
            return response.json();
        })
        .then(data => {
            countElement.textContent = data.value.toLocaleString("id-ID");
        })
        .catch(() => {
            // Fallback ke penyimpanan lokal browser jika API sedang tidak bisa dijangkau
            let localCount = parseInt(localStorage.getItem("adven_visitor_count") || "0", 10);
            localCount += 1;
            localStorage.setItem("adven_visitor_count", localCount);
            countElement.textContent = localCount.toLocaleString("id-ID");
        });
});