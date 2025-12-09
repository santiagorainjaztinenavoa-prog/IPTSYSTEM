// Admin Dashboard Reports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {

    // Firebase config
    const firebaseConfig = {
        apiKey: "AIzaSyBNWCNxC0d-YAem0Za51epjfl_WXcyDZSE",
        authDomain: "carousell-c3b3f.firebaseapp.com",
        databaseURL: "https://recommerce-default-rtdb.firebaseio.com/",
        projectId: "carousell-c3b3f",
        storageBucket: "carousell-c3b3f.firebasestorage.app",
        messagingSenderId: "33772869337",
        appId: "1:33772869337:web:f1f86a5cc8f71d0c1050c8"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    // ------------------ REPORT FILTER BUTTONS ------------------
    const dailyBtn = document.getElementById('dailyReportBtn');
    const weeklyBtn = document.getElementById('weeklyReportBtn');
    let currentPeriod = 'daily';

    dailyBtn.addEventListener('click', () => {
        currentPeriod = 'daily';
        dailyBtn.classList.add('bg-red-600', 'text-white');
        weeklyBtn.classList.remove('bg-red-600', 'text-white');
        weeklyBtn.classList.add('bg-gray-800', 'text-gray-300');
        fetchReports();
    });

    weeklyBtn.addEventListener('click', () => {
        currentPeriod = 'weekly';
        weeklyBtn.classList.add('bg-red-600', 'text-white');
        dailyBtn.classList.remove('bg-red-600', 'text-white');
        dailyBtn.classList.add('bg-gray-800', 'text-gray-300');
        fetchReports();
    });

    // ------------------ CHART INSTANCES ------------------
    let pieChart, categoryChart, dailySalesChart;

    function initCharts() {
        const pieCtx = document.getElementById('pieChartSales').getContext('2d');
        pieChart = new Chart(pieCtx, {
            type: 'pie',
            data: { labels: [], datasets: [{ label: 'Quantity', data: [], backgroundColor: ['#6366F1', '#EC4899', '#FACC15'] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: 'white' } } } }
        });

        const catCtx = document.getElementById('categoryBarChart').getContext('2d');
        categoryChart = new Chart(catCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Quantity Sold', data: [], backgroundColor: '#22D3EE' }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: 'white' } }, y: { ticks: { color: 'white' } } } }
        });

        const dailyCtx = document.getElementById('dailySalesChart').getContext('2d');
        dailySalesChart = new Chart(dailyCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Sales', data: [], borderColor: '#F43F5E', backgroundColor: 'rgba(244,63,94,0.2)', tension: 0.3, fill: true }] },
            options: { responsive: true, plugins: { legend: { labels: { color: 'white' } } }, scales: { x: { ticks: { color: 'white' } }, y: { ticks: { color: 'white' } } } }
        });
    }

    // ------------------ FETCH REPORTS ------------------
    async function fetchReports() {
        try {
            const dbRef = ref(db);
            const snapshot = await get(child(dbRef, `sales/${currentPeriod}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                updateCharts(data);
                renderPopularItems(data.items || []);
            } else {
                console.error("No data available for", currentPeriod);
                updateCharts({ pie: { labels: [], quantity: [] }, category: { labels: [], quantity: [] }, dailySales: { labels: [], data: [] } });
                renderPopularItems([]);
            }
        } catch (error) {
            console.error("Error fetching Firebase data:", error);
        }
    }

    // ------------------ UPDATE CHARTS ------------------
    function updateCharts(data) {
        // Pie chart: Quantity sold by category
        if (data.pie) {
            pieChart.data.labels = data.pie.labels || [];
            pieChart.data.datasets[0].data = data.pie.quantity || [];
            pieChart.update();
        }

        // Category Bar chart
        if (data.category) {
            categoryChart.data.labels = data.category.labels || [];
            categoryChart.data.datasets[0].data = data.category.quantity || [];
            categoryChart.update();
        }

        // Daily Sales Line chart
        if (data.dailySales) {
            dailySalesChart.data.labels = data.dailySales.labels || [];
            dailySalesChart.data.datasets[0].data = data.dailySales.data || [];
            dailySalesChart.update();
        }
    }

    // ------------------ RENDER POPULAR ITEMS ------------------
    function renderPopularItems(items) {
        const container = document.getElementById('popularItemsContainer');
        const empty = document.getElementById('popularItemsEmpty');
        container.innerHTML = '';

        if (!items || items.length === 0) {
            empty.classList.remove('hidden');
            return;
        } else {
            empty.classList.add('hidden');
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bg-gray-700 p-4 rounded-xl border border-gray-600 flex flex-col gap-2';
            card.innerHTML = `
                <p class="text-white font-semibold">${item.title}</p>
                <p class="text-gray-300 text-sm">Views: ${item.views}</p>
                <p class="text-gray-300 text-sm">Sales: ${item.quantity}</p>
                <p class="text-gray-300 text-sm">Revenue: ₱${item.price.toLocaleString()}</p>
            `;
            container.appendChild(card);
        });
    }

    // ------------------ INITIALIZE ------------------
    initCharts();
    fetchReports(); // initial load
});
