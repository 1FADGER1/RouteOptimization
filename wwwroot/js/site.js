document.addEventListener("DOMContentLoaded", async function () {
    console.log("Ожидание загрузки Yandex Maps API...");

    let checkInterval = setInterval(() => {
        if (window.ymaps3) {
            clearInterval(checkInterval);
            console.log("Yandex Maps API загружен!");
            initMap();
        }
    }, 500);

    setTimeout(() => {
        if (!window.ymaps3) console.error("Ошибка: Yandex Maps API не загрузился!");
    }, 10000);
});

let map, route;
let tempMarker = null; // Временная точка
let points = []; // Сохранённые точки

async function initMap() {
    await ymaps3.ready;
    const { YMap, YMapDefaultSchemeLayer, YMapListener, YMapMarker, YMapPolyline, YMapDefaultFeaturesLayer } = ymaps3;

    // Создаём карту
    map = new YMap(
        document.getElementById('map'),
        {
            location: {
                center: [39.200296, 51.660781],
                zoom: 10
            }
        },
        [new YMapDefaultSchemeLayer({ theme: "dark" }), new YMapDefaultFeaturesLayer()]
    );

    // УБЕДИМСЯ, ЧТО КЛИКИ ПРОХОДЯТ ЧЕРЕЗ МЕНЮ НА КАРТУ
    document.getElementById("menu").style.pointerEvents = "auto";
    document.getElementById("map").style.pointerEvents = "auto";

    // Клик по карте → создаёт временную точку
    const clickCallback = (object, event) => {
        const coords = event.coordinates;
        console.log('Координаты клика:', coords);

        if (tempMarker) {
            try {
                map.removeChild(tempMarker);
                console.log('Предыдущий tempMarker удалён');
                tempMarker = null; // Сбрасываем только после успешного удаления
            } catch (e) {
                console.error('Ошибка при удалении tempMarker:', e);
                tempMarker = null; // Сбрасываем, если удаление не удалось
            }
        }

        // Создание элемента метки
        const markerElement = document.createElement('div');
        markerElement.className = 'marker-class';
        markerElement.innerText = "↓";

        tempMarker = new YMapMarker({ coordinates: coords }, markerElement);
        map.addChild(tempMarker);

        if (confirm("Добавить эту точку в маршрут?")) {
            addPoint(coords);
        }
    };

    const mapListener = new YMapListener({
        layer: 'any', // Слушаем события на любом слое
        onClick: clickCallback, // Устанавливаем обработчик кликов
    });

    map.addChild(mapListener);

    // Обработка ввода координат
    document.getElementById("findPoint").addEventListener("click", () => {
        let input = document.getElementById("pointInput").value.trim();
        let coords = input.split(",").map(coord => parseFloat(coord.trim()));

        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            addPoint(coords);
        } else {
            alert("Пожалуйста, введите корректные координаты в формате: широта, долгота");
        }
    });
}

// Функция добавления точки
function addPoint(coords) {
    points.push(coords);

    const { YMapMarker } = ymaps3;
    const markerElement = document.createElement('div');
    markerElement.className = 'permanent-marker';
    markerElement.innerText = `Точка ${points.length}`;

    const marker = new YMapMarker({ coordinates: coords }, markerElement);
    map.addChild(marker);

    let listItem = document.createElement("li");
    listItem.textContent = `Точка ${points.length}: ${coords.join(", ")}`;
    document.getElementById("pointsList").appendChild(listItem);
}

document.getElementById("buildRoute").addEventListener("click", async () => {
    if (points.length < 2) {
        alert("Добавьте хотя бы 2 точки!");
        return;
    }

    // Удаляем предыдущий маршрут, если он есть
    if (route) map.removeChild(route);

    try {
        // Полная конфигурация для ymaps3.route()
        const routeData = await ymaps3.route({
            points: points.map(p => ({ type: 'point', coordinates: p })), // Формат: массив объектов с типом и координатами
            mode: 'auto', // Режим маршрута
            multiRoute: false // Одиночный маршрут
        });
        console.log("Данные маршрута:", routeData);

        // Предполагаем, что routeData возвращает GeoJSON или подобный формат
        route = new ymaps3.YMapGeoJsonLayer({
            features: routeData, // Используем данные маршрута как GeoJSON
            style: {
                stroke: [{ color: '#ff0000', width: 3 }]
            }
        });
        map.addChild(route);

        // Время маршрута
        const duration = routeData.duration?.value || routeData.properties?.duration;
        if (duration) {
            const minutes = Math.round(duration / 60);
            document.getElementById("routeInfo").textContent = `Время маршрута: ${minutes} мин`;
        } else {
            document.getElementById("routeInfo").textContent = "Время маршрута недоступно";
        }
    } catch (error) {
        console.error("Ошибка построения маршрута:", error);
        alert("Не удалось построить маршрут.");
    }
});