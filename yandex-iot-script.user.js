// ==UserScript==
// @name         aboba
// @namespace    http://tampermonkey.net/
// @version      1.37
// @description  Получение, отображение, экспорт, импорт и удаление сценариев и управление устройствами в Yandex IoT с улучшенным предпросмотром сценариев и выбором имени файла
// @author       Me
// @match        https://yandex.ru/iot/*
// @icon         https://yandex.ru/favicon.ico
// @grant        none
// @require      https://unpkg.com/js-yaml@4.1.0/dist/js-yaml.min.js
// ==/UserScript==

(function () {
    'use strict';

    let importSettingsState = null;
    let importResultsState = null;
    let lastImportedData = null;

    const getTheme = () => (document.documentElement.classList.contains('theme_dark') ? 'dark' : 'light');

    const THEMES = {
        light: {
            primary: '#6a00ff',
            accent: '#ff8c00',
            text: '#333333',
            buttonTextActive: '#ffffff',
            headingText: '#333333',
            groupHeaderText: '#333333'
        },
        dark: {
            primary: '#a788ff',
            accent: '#ffd700',
            text: '#d3d3d3',
            buttonTextActive: '#d3d3d3',
            headingText: '#d3d3d3',
            groupHeaderText: '#d3d3d3'
        },
    };

    let COLORS = THEMES[getTheme()];

    const STYLES = {
        container: { padding: '10px', backgroundColor: 'transparent', borderRadius: '10px', marginTop: '10px', marginBottom: '10px' },
        button: { margin: '5px', padding: '5px 10px', cursor: 'pointer', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', transition: 'background-color 0.2s' },
        content: { marginTop: '10px', overflowY: 'auto' },
        listContainer: { margin: '10px 0', padding: '10px', borderRadius: '8px', overflowY: 'auto' },
        table: { width: '100%', borderCollapse: 'collapse' },
        th: { padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '4px' },
        td: { padding: '8px', transition: 'background-color 0.2s' },
        spinner: {
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: `3px solid ${COLORS.accent}`,
            borderTop: '3px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            boxSizing: 'border-box',
            minWidth: '16px',
            minHeight: '16px',
        },
        notification: {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: getTheme() === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            padding: '10px 15px',
            borderRadius: '5px',
            color: COLORS.text,
            display: 'flex',
            alignItems: 'center',
            zIndex: '1000',
            boxShadow: `0 0 5px ${COLORS.primary}`,
        },
        deleteIcon: { cursor: 'pointer', fontSize: '16px', padding: '2px' },
        modal: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: getTheme() === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            padding: '20px',
            borderRadius: '10px',
            zIndex: '1000',
            color: COLORS.text,
            maxWidth: '600px',
            boxShadow: `0 0 10px ${COLORS.primary}`,
            maxHeight: '80vh',
            overflowY: 'auto',
        },
        input: {
            margin: '5px',
            padding: '5px',
            borderRadius: '5px',
            border: `1px solid ${COLORS.primary}`,
            color: COLORS.text,
            backgroundColor: 'transparent',
        },
    };

    const applyStyles = (element, styles) => Object.assign(element.style, styles);

    /*=========================================================================
      attachSpinner – превращает кнопку в маленький «круговой» спиннер
    =========================================================================*/
    const attachSpinner = (btn, on = true) => {
        if (on) {
            if (btn.dataset._spinnerAttached) return; // уже крутится
            btn.dataset._spinnerAttached = '1';

            // запомним старое содержимое, чтобы потом вернуть
            btn.dataset._innerHtml = btn.innerHTML;

            // очистили и вставили css‑спиннер
            btn.innerHTML = '';
            const spin = document.createElement('span');
            applyStyles(spin, { ...STYLES.spinner, margin: '0 6px' });
            btn.appendChild(spin);
        } else {
            if (!btn.dataset._spinnerAttached) return; // ничего не делали
            btn.innerHTML = btn.dataset._innerHtml; // вернули старое
            delete btn.dataset._spinnerAttached;
            delete btn.dataset._innerHtml;
        }
    };

    const updateTheme = () => {
        COLORS = THEMES[getTheme()];

        STYLES.spinner.border = `3px solid ${COLORS.accent}`;
        STYLES.notification.backgroundColor = getTheme() === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        STYLES.notification.color = COLORS.text;
        STYLES.notification.boxShadow = `0 0 5px ${COLORS.primary}`;
        STYLES.modal.backgroundColor = getTheme() === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        STYLES.modal.color = COLORS.text;
        STYLES.modal.boxShadow = `0 0 10px ${COLORS.primary}`;
        STYLES.input.border = `1px solid ${COLORS.primary}`;
        STYLES.input.color = COLORS.text;

        const container = document.querySelector('#custom-iot-container');
        if (container) {
            applyStyles(container, {
                ...STYLES.container,
                border: `1px solid ${COLORS.primary}`,
                color: COLORS.text,
                boxShadow: `0 0 10px ${COLORS.primary}`,
            });
            container.querySelectorAll('button').forEach((button) => {
                applyStyles(button, {
                    ...STYLES.button,
                    color: button.classList.contains('active') ? COLORS.buttonTextActive : COLORS.text,
                    border: `1px solid ${COLORS.primary}`,
                    backgroundColor: button.classList.contains('active') ? COLORS.primary : 'transparent',
                });
            });
            container.querySelectorAll('input').forEach((input) => {
                applyStyles(input, STYLES.input);
            });
            applyStyles(container.querySelector('#custom-iot-content'), STYLES.content);
            container.querySelectorAll('.list-container').forEach((list) => {
                applyStyles(list, { ...STYLES.listContainer, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                applyStyles(list.querySelector('h3'), { color: COLORS.headingText });
                applyStyles(list.querySelector('table'), { ...STYLES.table, color: COLORS.text });
                list.querySelectorAll('th').forEach((th) =>
                    applyStyles(th, { ...STYLES.th, border: `1px solid ${COLORS.primary}`, color: COLORS.text })
                );
                list.querySelectorAll('td').forEach((td) =>
                    applyStyles(td, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text })
                );
                list.querySelectorAll('ul li').forEach((li) => applyStyles(li, { color: COLORS.text }));
            });
            container.querySelectorAll('h2').forEach((h2) => applyStyles(h2, { color: COLORS.headingText }));
        }

        const notification = document.querySelector('#notification');
        if (notification) applyStyles(notification, STYLES.notification);

        const modal = document.querySelector('#scenario-details-modal');
        if (modal) applyStyles(modal, STYLES.modal);
    };

    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        #custom-iot-container button:hover { background-color: rgba(106, 0, 255, 0.1); }
        #custom-iot-container tr:hover td { background-color: rgba(106, 0, 255, 0.05); }
        #custom-iot-container input:hover { background-color: rgba(106, 0, 255, 0.05); }
    `;
    document.head.appendChild(styleSheet);

    const selectableStyle = document.createElement('style');
    selectableStyle.textContent = `
        #custom-iot-container,
        #custom-iot-container * {
            user-select: text !important;
            -webkit-user-select: text !important;
        }
    `;
    document.head.appendChild(selectableStyle);

    const showNotification = (message = 'Обработка...') => {
        let notification = document.querySelector('#notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            document.body.appendChild(notification);
        }
        notification.innerHTML = '';
        applyStyles(notification, STYLES.notification);

        const spinner = document.createElement('span');
        applyStyles(spinner, STYLES.spinner);
        const text = document.createElement('span');
        text.textContent = message;
        applyStyles(text, { marginLeft: '10px' });

        notification.appendChild(spinner);
        notification.appendChild(text);
        return notification;
    };

    const hideNotification = () => {
        const notification = document.querySelector('#notification');
        if (notification) notification.remove();
    };

    const formatDateTime = (date) =>
        date.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

    const createResultHeader = (startTime, duration, fileName = '') => {
        const header = document.createElement('h2');
        header.textContent = `${fileName ? 'Результат импорта данных' : 'Данные УДЯ'}${fileName ? `\nФайл: ${fileName}` : ''}\nНачало: ${formatDateTime(
            startTime
        )}\nЗавершено за: ${(duration / 1000).toFixed(2)} сек`;
        applyStyles(header, { color: COLORS.headingText, whiteSpace: 'pre-line' });
        updateTheme();
        return header;
    };

    const fetchData = async (url, method = 'GET', body = null, timeout = 15000) => {
        const csrfToken = window.storage?.csrfToken2 || '';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'x-csrf-token': csrfToken, ...(body && { 'Content-Type': 'application/json' }) },
                body,
                signal: controller.signal,
            });
            clearTimeout(timer);
            if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
            const data = await response.json();
            return method === 'DELETE' ? data.status === 'ok' : data;
        } catch (error) {
            clearTimeout(timer);
            if (error.name === 'AbortError') {
                return { error: 'Таймаут: Яндекс не ответил. Возможно, в группе есть офлайн-устройство' };
            }
            return null;
        }
    };

    /* ------------------------------------------------------------------
       Карта «id устройства → имя». Заполняем при первом же обращении
    ------------------------------------------------------------------*/
    let deviceNameMap = null;
    const ensureDeviceNameMap = async () => {
        if (deviceNameMap) return deviceNameMap;
        const data = await fetchDevices();
        deviceNameMap = Object.values(data.devices || {}).reduce((m, d) => ((m[d.id] = d.name || d.id), m), {});
        return deviceNameMap;
    };

    /* ------------------------------------------------------------------
       Форматирование триггеров c заменой id на имя устройства
    ------------------------------------------------------------------*/
    const formatTriggers = (triggers) => {
        if (!triggers || !triggers.length) return ['—'];
        return triggers.map((t) => {
            const trg = t.trigger || t; // два возможных формата
            const type = trg.type || '—';

            /* пытаемся вытащить device_id из разных схем */
            const devId = trg.device_id ?? trg.value?.device_id ?? trg.value?.id ?? null;

            let valueOut;
            if (devId) {
                const name = deviceNameMap?.[devId] || devId;
                valueOut = `устройство «${name}»`;
            } else {
                const v = trg.value;
                valueOut = typeof v === 'object' ? JSON.stringify(v) : v ?? '—';
            }
            return `${type} → ${valueOut}`;
        });
    };

    /* ------------------------------------------------------------------
       Основная функция «раскрыть подробности» прямо в таблице
    ------------------------------------------------------------------*/
    const showScenarioDetails = async (scenario, btnEl) => {
        await ensureDeviceNameMap(); // карта имён устройств

        /* включаем маленький спиннер на кнопке */
        attachSpinner(btnEl, true);
        btnEl.disabled = true; // опционально – защита от повторных кликов

        /* ---- получаем расширенную модель сценария ---- */
        let full = scenario; // mutable
        let resp; // также mutable

        try {
            resp = await fetchScenarioDetails(scenario.id);
            if (resp?.status === 'ok' && resp.scenario) full = resp.scenario;
        } finally {
            /* снимаем спиннер в любом случае */
            attachSpinner(btnEl, false);
            btnEl.disabled = false;
        }
        if (resp?.status === 'ok' && resp.scenario) full = resp.scenario;

        const table = btnEl.closest('table');
        if (!table) return;

        /* удалить предыдущую раскрытую строку (если была) */
        const opened = table.querySelector('tr.scenario-details-row');
        if (opened) opened.remove();

        const hostRow = btnEl.closest('tr');
        const detailsTr = document.createElement('tr');
        detailsTr.className = 'scenario-details-row';

        const detailsTd = document.createElement('td');
        detailsTd.colSpan = hostRow.children.length;
        applyStyles(detailsTd, {
            padding: '10px',
            border: `1px solid ${COLORS.primary}`,
        });

        /* ---------- Заголовок ---------- */
        const h4 = document.createElement('h4');
        h4.textContent = `${full.name || 'Без названия'} (ID: ${full.id || '—'})`;
        applyStyles(h4, { margin: '0 0 6px 0', color: COLORS.headingText });
        detailsTd.appendChild(h4);

        /* ---------- Триггеры ---------- */
        const trgTitle = document.createElement('strong');
        trgTitle.textContent = 'Триггеры:';
        detailsTd.appendChild(trgTitle);

        const trgUl = document.createElement('ul');
        (full.triggers || []).forEach((t) => {
            const trg = t.trigger || t;
            const type = trg.type || '—';
            const value = typeof trg.value === 'object' ? JSON.stringify(trg.value) : trg.value ?? '—';
            const li = document.createElement('li');
            li.textContent = `${type} → ${value}`;
            applyStyles(li, { color: COLORS.text });
            trgUl.appendChild(li);
        });
        if (!trgUl.children.length) {
            const li = document.createElement('li');
            li.textContent = '—';
            trgUl.appendChild(li);
        }
        detailsTd.appendChild(trgUl);

        /* ---------- Шаги ---------- */
        const stepsTitle = document.createElement('strong');
        stepsTitle.textContent = 'Шаги:';
        stepsTitle.style.display = 'block';
        stepsTitle.style.marginTop = '4px';
        detailsTd.appendChild(stepsTitle);

        const stepsUl = document.createElement('ul');
        stepsUl.innerHTML = formatSteps(full.steps);
        applyStyles(stepsUl, { color: COLORS.text });
        detailsTd.appendChild(stepsUl);

        /* ---------- Кнопка «Свернуть» ---------- */
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Свернуть';
        applyStyles(closeBtn, {
            ...STYLES.button,
            color: COLORS.text,
            border: `1px solid ${COLORS.primary}`,
            backgroundColor: 'transparent',
            marginTop: '6px',
        });
        closeBtn.onclick = () => detailsTr.remove();
        detailsTd.appendChild(closeBtn);

        detailsTr.appendChild(detailsTd);
        hostRow.insertAdjacentElement('afterend', detailsTr);
    };

    const fetchScenarios = () => fetchData('https://iot.quasar.yandex.ru/m/user/scenarios');
    const fetchDevices = () =>
        fetchData('https://iot.quasar.yandex.ru/m/v3/user/devices').then((data) => {
            const devices = {};
            const groups = {};
            (data?.households || []).forEach((household) => {
                (household?.all || []).forEach((item) => {
                    if (item.item_type === 'group') {
                        groups[item.id] = item;
                    } else {
                        devices[item.id] = item;
                    }
                });
            });
            return {
                devices,
                groups: Object.values(groups),
            };
        });
    const fetchGroupDetails = (groupId) => fetchData(`https://iot.quasar.yandex.ru/m/user/groups/${groupId}`);
    const fetchScenarioDetails = (scenarioId) => fetchData(`https://iot.quasar.yandex.ru/m/v4/user/scenarios/${scenarioId}/edit`);
    const deleteScenario = (id) => fetchData(`https://iot.quasar.yandex.ru/m/user/scenarios/${id}`, 'DELETE');
    const toggleScenarioActivation = (id, isActive) =>
        fetchData(`https://iot.quasar.yandex.ru/m/user/scenarios/${id}/activation`, 'POST', JSON.stringify({ is_active: isActive }));

    const toggleEntityState = async (item, isOn) => {
        const url =
              item.item_type === 'group'
        ? `https://iot.quasar.yandex.ru/m/user/groups/${item.id}/actions`
        : `https://iot.quasar.yandex.ru/m/user/devices/${item.id}/actions`;
        const response = await fetchData(url, 'POST', JSON.stringify({
            actions: [
                {
                    type: 'devices.capabilities.on_off',
                    state: { instance: 'on', value: isOn },
                },
            ],
        }));

        // Проверяем ответ сервера
        if (!response) {
            return { success: false, error: 'Нет ответа от сервера' };
        }

        if (response.status === 'error') {
            return { success: false, error: response.message || 'Ошибка выполнения команды' };
        }

        if (response.status === 'ok' && response.devices?.length) {
            const device = response.devices[0];
            const capability = device.capabilities?.find(c => c.type === 'devices.capabilities.on_off');
            if (capability?.state?.action_result?.status === 'DONE') {
                return { success: true };
            }
            return { success: false, error: 'Команда не выполнена' };
        }

        return { success: false, error: 'Неизвестный формат ответа' };
    };

    const waitForElm = (selector) =>
        new Promise((resolve) => {
            console.log('[waitForElm] Ожидание элемента:', selector);
            const element = document.querySelector(selector);
            if (element) {
                console.log('[waitForElm] Элемент найден сразу:', element);
                return resolve(element);
            }
            const observer = new MutationObserver(() => {
                const found = document.querySelector(selector);
                if (found) {
                    console.log('[waitForElm] Элемент найден через observer:', found);
                    observer.disconnect();
                    resolve(found);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });

    const createTableHeaders = (isSettingsTab, isResultsTab, table, isDevices = false, isGroups = false) => {
        let headers;
        if (isSettingsTab) {
            headers = ['Выбрать', 'ID', 'Название', 'Тип/Иконка', 'Статус'];
        } else if (isResultsTab) {
            headers = ['ID', 'Название', 'Тип/Иконка', 'Статус'];
        } else if (isDevices) {
            headers = ['ID', 'Название', 'Тип/Иконка', 'Вкл/выкл', 'Удалить'];
        } else if (isGroups) {
            headers = ['ID', 'Название', 'Тип/Иконка', 'Вкл/выкл', 'Удалить', 'Подробности'];
        } else {
            headers = ['ID', 'Название', 'Тип/Иконка', 'Вкл/выкл', 'Удалить', 'Подробности'];
        }
        const thead = document.createElement('thead');
        const row = document.createElement('tr');
        headers.forEach((text, index) => {
            const th = document.createElement('th');
            if (isSettingsTab && index === 0) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.addEventListener('change', () =>
                    table.querySelectorAll('tbody input[type="checkbox"]').forEach((cb) => (cb.checked = checkbox.checked))
                );
                th.appendChild(checkbox);
            } else {
                th.textContent = text;
            }
            applyStyles(th, { ...STYLES.th, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
            row.appendChild(th);
        });
        thead.appendChild(row);
        return thead;
    };

    /* ------------------------------------------------------------
       Утилита: человеко‑читаемое имя устройства/сценария
    ------------------------------------------------------------ */
    const deviceName = (id) => (deviceNameMap && deviceNameMap[id] ? deviceNameMap[id] : id);

    /* ------------------------------------------------------------
       Форматирование шагов
    ------------------------------------------------------------ */
    function formatSteps(steps) {
        if (!steps?.length) return '<li>Нет шагов</li>';
        const out = [];

        steps.forEach((step, i) => {
            /* ---------- Пауза ---------- */
            if (step.type === 'scenarios.steps.delay') {
                const ms = step.parameters?.delay_ms || 0;
                const txt =
                    ms >= 60000 && ms % 60000 === 0
                        ? `${ms / 60000} мин.`
                        : ms >= 1000 && ms % 1000 === 0
                        ? `${ms / 1000} сек.`
                        : `${ms} мс.`;
                out.push(`<li>Пауза: ${txt}</li>`);
                return;
            }

            /* ---------- Действия над элементами ---------- */
            if (step.type === 'scenarios.steps.actions.v2') {
                const items = step.parameters?.items || [];
                if (!items.length) {
                    out.push('<li>Шаг без устройств</li>');
                    return;
                }

                items.forEach((item) => {
                    /* 1. Имя объекта */
                    let objName = item.value?.name || item.name || deviceName(item.id);

                    /* Виртуальный идентификатор всех колонок */
                    if (item.id === 'all_speakers_in_household') objName = 'Все колонки в доме';

                    /* 2. Обработка «это сценарий, а не устройство» */
                    if (item.type === 'step.action.item.scenario' || item.value?.item_type === 'scenario') {
                        const enabled = !!item.value?.value?.enabled;
                        out.push(`<li>Сценарий «${objName}» будет ${enabled ? 'включён' : 'выключен'}</li>`);
                        return;
                    }

                    /* 3. Обычные устройства -------------------------------- */
                    const caps = item.value?.capabilities || [];
                    if (!caps.length) {
                        out.push(`<li>${objName}: действие не указано</li>`);
                        return;
                    }

                    caps.forEach((cap) => {
                        const inst = cap.state?.instance;
                        const val = cap.state?.value;

                        switch (cap.type) {
                            case 'devices.capabilities.quasar':
                                if (inst === 'tts') out.push(`<li>${objName} скажет: «${val?.text || ''}»</li>`);
                                else if (inst === 'stop_everything') out.push(`<li>${objName} остановит всё</li>`);
                                break;

                            case 'devices.capabilities.quasar.server_action':
                                // instance == text_action
                                out.push(`<li>${objName} выполнит действие: «${val}»</li>`);
                                break;

                            case 'devices.capabilities.on_off':
                                out.push(`<li>${objName} ${val ? 'включится' : 'выключится'}</li>`);
                                break;

                            case 'devices.capabilities.range':
                                if (inst === 'brightness') out.push(`<li>${objName} установит яркость: ${val}</li>`);
                                break;

                            case 'devices.capabilities.color_setting':
                                out.push(`<li>${objName} установит цвет: ${JSON.stringify(val)}</li>`);
                                break;

                            default:
                                out.push(`<li>${objName}: ${cap.type} • ${inst ?? '—'} • ${JSON.stringify(val)}</li>`);
                        }
                    });
                });
                return;
            }

            /* ---------- Неизвестный тип шага ---------- */
            out.push(`<li>Неизвестный шаг ${i + 1}: ${step.type}</li>`);
        });

        return out.join('');
    }

    const showGroupDetails = async (group) => {
        const modal = document.createElement('div');
        modal.id = 'group-details-modal';
        applyStyles(modal, STYLES.modal);

        const notification = showNotification('Загрузка данных группы...');
        const groupData = await fetchGroupDetails(group.id);
        hideNotification();

        if (!groupData || groupData.status !== 'ok') {
            modal.innerHTML = `
                <h3 style="color: ${COLORS.headingText}">${group.name || 'Без названия'}</h3>
                <p style="color: ${COLORS.text}">Ошибка загрузки данных группы.</p>
                <button>Закрыть</button>
            `;
        } else {
            const devices = groupData.devices || [];
            const devicesHtml = devices.length
                ? devices
                      .map((device) => {
                          const capabilities =
                              device.capabilities
                                  ?.map((c) => {
                                      const state = c.state ? `${c.state.instance}: ${c.state.value}` : '—';
                                      return `${c.type} (${state})`;
                                  })
                                  .join('; ') || 'Нет возможностей';
                          return `<li><strong>Имя:</strong> ${device.name || '—'}<br><strong>ID:</strong> ${device.id || '—'}<br><strong>Тип:</strong> ${
                              device.type || '—'
                          }<br><strong>Возможности:</strong> ${capabilities}</li>`;
                      })
                      .join('')
                : 'Нет устройств в группе';

            modal.innerHTML = `
                <h3 style="color: ${COLORS.headingText}">${groupData.name || 'Без названия'}</h3>
                <p><strong>ID:</strong> ${groupData.id || '—'}</p>
                <p><strong>Тип:</strong> ${groupData.type || '—'}</p>
                <p><strong>Статус:</strong> ${groupData.state || '—'}</p>
                <p><strong>Устройства:</strong></p>
                <ul style="color: ${COLORS.text}; margin-left: 20px;">${devicesHtml}</ul>
                <button>Закрыть</button>
            `;
        }

        const closeButton = modal.querySelector('button');
        applyStyles(closeButton, {
            ...STYLES.button,
            color: COLORS.text,
            border: `1px solid ${COLORS.primary}`,
            backgroundColor: 'transparent',
            marginTop: '10px',
        });
        closeButton.onclick = () => modal.remove();

        document.body.appendChild(modal);
    };


    const createTableRows = (data, isSettingsTab, isResultsTab, isDevices = false, isGroups = false) => {
        const tbody = document.createElement('tbody');
        data.forEach((item, index) => {
            const row = document.createElement('tr');
            if (isSettingsTab) {
                const checkboxTd = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.dataset.index = index;
                checkboxTd.appendChild(checkbox);
                applyStyles(checkboxTd, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                row.appendChild(checkboxTd);
            }
            [item.id || '—', item.name || 'Без названия', item.type || item.icon || '—'].forEach((text) => {
                const td = document.createElement('td');
                td.textContent = text;
                applyStyles(td, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                row.appendChild(td);
            });
            const statusTd = document.createElement('td');
            if (isSettingsTab || isResultsTab) {
                statusTd.textContent = item.status || '—';
                if (item.lastAttempt === true) {
                    statusTd.textContent = item.status === '✅' ? '✅' : item.status === '❌' ? '❌' : item.status;
                } else if (item.status === '✅') {
                    statusTd.textContent = '✔';
                } else if (item.status === '❌') {
                    statusTd.textContent = '✖';
                }
                if (item.error) statusTd.title = item.error;
                if (isSettingsTab) statusTd.dataset.index = index;
            } else {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = isDevices
                    ? item.capabilities?.some((c) => c.type === 'devices.capabilities.on_off' && c.state?.value) || false
                : item.is_active !== false;
                checkbox.addEventListener('change', async () => {
                    if (isDevices || isGroups) {
                        const notification = showNotification('Переключение устройства/группы...');
                        const result = await toggleEntityState(item, checkbox.checked);
                        hideNotification();

                        if (!result.success) {
                            // Возвращаем чекбокс в предыдущее состояние и показываем ошибку
                            checkbox.checked = !checkbox.checked;
                            showNotification(result.error || 'Ошибка выполнения команды');
                            setTimeout(hideNotification, 3000); // Убираем уведомление через 3 секунды
                        }
                    } else {
                        const notification = showNotification('Переключение сценария...');
                        const success = await toggleScenarioActivation(item.id, checkbox.checked);
                        hideNotification();
                        if (!success) {
                            checkbox.checked = !checkbox.checked;
                        }
                    }
                });
                statusTd.appendChild(checkbox);
            }
            applyStyles(statusTd, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
            row.appendChild(statusTd);

            if (!isSettingsTab && !isResultsTab) {
                const deleteTd = document.createElement('td');
                const deleteIcon = document.createElement('span');
                deleteIcon.textContent = '🗑️';
                deleteIcon.title = 'Удалить';
                applyStyles(deleteIcon, STYLES.deleteIcon);
                deleteIcon.onclick = async () => {
                    if (confirm(`Вы уверены, что хотите удалить ${isDevices ? 'устройство' : isGroups ? 'группу' : 'сценарий'} "${item.name || item.id}"?`)) {
                        const notification = showNotification('Удаление...');
                        const success = await deleteScenario(item.id);
                        hideNotification();
                        if (success) row.remove();
                    }
                };
                deleteTd.appendChild(deleteIcon);
                applyStyles(deleteTd, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                row.appendChild(deleteTd);

                if (!isDevices && (isGroups || !isDevices)) {
                    const detailsTd = document.createElement('td');
                    const detailsButton = document.createElement('button');
                    detailsButton.textContent = '📄';
                    detailsButton.title = 'Подробности';
                    applyStyles(detailsButton, {
                        ...STYLES.button,
                        padding: '2px 5px',
                        color: COLORS.text,
                        border: `1px solid ${COLORS.primary}`,
                    });
                    detailsButton.onclick = (e) => {
                        if (isGroups) {
                            showGroupDetails(item);
                        } else {
                            showScenarioDetails(item, e.currentTarget);
                        }
                    };
                    detailsTd.appendChild(detailsButton);
                    applyStyles(detailsTd, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                    row.appendChild(detailsTd);
                }
            }
            tbody.appendChild(row);
        });
        return tbody;
    };

    const createImportTable = (data, isSettingsTab = false, isResultsTab = false, isDevices = false, isGroups = false) => {
        const table = document.createElement('table');
        applyStyles(table, { ...STYLES.table, color: COLORS.text });
        table.appendChild(createTableHeaders(isSettingsTab, isResultsTab, table, isDevices, isGroups));
        table.appendChild(createTableRows(data, isSettingsTab, isResultsTab, isDevices, isGroups));
        return table;
    };

    const createListContainer = (titleText, items, isSettingsTab, isResultsTab, isDevices = false, isGroups = false) => {
        const container = document.createElement('div');
        container.className = 'list-container';
        applyStyles(container, { ...STYLES.listContainer, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
        const title = document.createElement('h3');
        title.textContent = titleText;
        applyStyles(title, { color: COLORS.headingText });
        container.appendChild(title);
        container.appendChild(createImportTable(items, isSettingsTab, isResultsTab, isDevices, isGroups));
        return container;
    };

    const createDataTable = (scenarios, devices, groups, startTime, duration, fileName = '') => {
        const container = document.createElement('div');
        container.appendChild(createResultHeader(startTime, duration, fileName));
        const scenariosData = (scenarios?.scenarios || []).map((s) => ({ ...s }));
        const devicesData = (devices?.devices ? Object.values(devices.devices) : []).map((d) => ({ ...d }));
        const groupsData = (devices?.groups || []).map((g) => ({ ...g }));

        if (scenariosData.length) container.appendChild(createListContainer('Сценарии', scenariosData, false, fileName !== ''));
        if (devicesData.length) container.appendChild(createListContainer('Устройства', devicesData, false, fileName !== '', true));
        if (groupsData.length) container.appendChild(createListContainer('Группы', groupsData, false, fileName !== '', false, true));

        const errors = [...scenariosData, ...devicesData, ...groupsData]
            .filter((item) => item.error)
            .map((item) => `${item.name || item.id}: ${item.error}`);
        if (errors.length) {
            const errorList = document.createElement('div');
            errorList.className = 'list-container';
            applyStyles(errorList, { ...STYLES.listContainer, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
            const title = document.createElement('h3');
            title.textContent = 'Ошибки импорта';
            applyStyles(title, { color: COLORS.headingText });
            errorList.appendChild(title);
            const ul = document.createElement('ul');
            errors.forEach((error) => {
                const li = document.createElement('li');
                li.textContent = error;
                applyStyles(li, { color: COLORS.text });
                ul.appendChild(li);
            });
            errorList.appendChild(ul);
            container.appendChild(errorList);
        }
        return container;
    };

    const displayData = (container, scenarios, devices, groups, startTime, duration, tabId, fileName = '') => {
        const tab = container.querySelector(`#${tabId}`);
        tab.innerHTML = '';
        tab.appendChild(createDataTable(scenarios, devices, groups, startTime, duration, fileName));
    };

    const exportToYaml = (devicesData, scenariosData, fileName) => {
        if (!devicesData?.devices?.length && !devicesData?.groups?.length && !scenariosData?.scenarios?.length) {
            return alert('Нет данных для экспорта.');
        }
        try {
            const exportData = { devices: devicesData?.devices || [], groups: devicesData?.groups || [], scenarios: scenariosData?.scenarios || [] };
            const yamlContent = jsyaml.dump(exportData);
            const blob = new Blob([yamlContent], { type: 'text/yaml' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName.endsWith('.yaml') || fileName.endsWith('.yml') ? fileName : `${fileName}.yaml`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('[exportToYaml] Ошибка:', error.message);
            alert('Ошибка при экспорте.');
        }
    };

    const importScenario = async (scenario) => {
        try {
            const csrfToken = window.storage?.csrfToken2 || '';
            const body = JSON.stringify({
                name: scenario.name || 'Imported Scenario',
                icon: scenario.icon || 'home',
                triggers:
                    scenario.triggers?.map((t) => ({
                        trigger: {
                            type: t.trigger?.type || 'scenario.trigger.timetable',
                            value: t.trigger?.value || '12:00',
                            slotId: t.trigger?.type || 'scenario.trigger.timetable',
                        },
                        filters: [],
                    })) || [{ trigger: { type: 'scenario.trigger.voice', value: 'Тест', slotId: 'scenario.trigger.voice' }, filters: [] }],
                steps:
                    scenario.steps?.map((s) => ({
                        type: s.type || 'scenarios.steps.actions.v2',
                        parameters: {
                            items:
                                s.parameters?.items?.map((item) => ({
                                    id: item.id,
                                    type: item.type || 'step.action.item.device',
                                    value: {
                                        id: item.id,
                                        name: item.name || 'Unnamed Device',
                                        type: item.type || 'devices.types.light',
                                        capabilities: [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: true, relative: false } }],
                                        directives: [],
                                        device_ids: [],
                                    },
                                })) || [],
                        },
                    })) || [{ type: 'scenarios.steps.actions.v2', parameters: { items: [] } }],
                settings: { continue_execution_after_error: false },
            });
            const response = await fetch('https://iot.quasar.yandex.ru/m/v4/user/scenarios/', {
                method: 'POST',
                credentials: 'include',
                headers: { 'x-csrf-token': csrfToken, 'Content-Type': 'application/json' },
                body,
                timeout: 30000,
            });
            if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
            return { success: true };
        } catch (error) {
            console.error('[importScenario] Ошибка:', error.message);
            return { success: false, error: error.message };
        }
    };

    const importFromYaml = async (file, contentContainer, importInput) => {
        const notification = showNotification('Загрузка файла...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = jsyaml.load(e.target.result);
                const scenariosData = {
                    scenarios: (data.scenarios || []).map((s) => ({ ...s, status: s.status || '—', lastAttempt: false })),
                };
                const devicesData = {
                    devices: (data.devices || []).map((d) => ({ ...d, status: d.status || '—', lastAttempt: false })),
                    groups: (data.groups || []).map((g) => ({ ...g, status: g.status || '—', lastAttempt: false })),
                };

                // Сохраняем данные файла
                lastImportedData = {
                    fileName: file.name,
                    scenarios: scenariosData.scenarios,
                    devices: devicesData.devices,
                    groups: devicesData.groups,
                };

                contentContainer.innerHTML = ''; // Очищаем содержимое
                const settingsContainer = document.createElement('div');
                const header = document.createElement('h2');
                header.textContent = `Настройки импорта\nФайл: ${file.name}`;
                applyStyles(header, { color: COLORS.headingText, whiteSpace: 'pre-line' });
                settingsContainer.appendChild(header);

                let scenariosTable, devicesTable, groupsTable;
                if (scenariosData.scenarios.length) {
                    const container = createListContainer('Сценарии', scenariosData.scenarios, true, false);
                    scenariosTable = container.querySelector('table');
                    settingsContainer.appendChild(container);
                }
                if (devicesData.devices.length) {
                    const container = createListContainer('Устройства', devicesData.devices, true, false);
                    devicesTable = container.querySelector('table');
                    settingsContainer.appendChild(container);
                }
                if (devicesData.groups.length) {
                    const container = createListContainer('Группы', devicesData.groups, true, false);
                    groupsTable = container.querySelector('table');
                    settingsContainer.appendChild(container);
                }

                const importSelectedButton = document.createElement('button');
                importSelectedButton.textContent = 'Импортировать выбранное';
                applyStyles(importSelectedButton, { ...STYLES.button, color: COLORS.text, border: `1px solid ${COLORS.primary}` });
                settingsContainer.appendChild(importSelectedButton);

                importSelectedButton.onclick = async () => {
                    const startTime = new Date();
                    const notification = showNotification('Импорт данных...');
                    try {
                        for (const [type, items, table] of [
                            ['scenarios', scenariosData.scenarios, scenariosTable],
                            ['devices', devicesData.devices, devicesTable],
                            ['groups', devicesData.groups, groupsTable],
                        ]) {
                            if (!items.length) continue;
                            const checkboxes = table?.querySelectorAll('tbody input[type="checkbox"]') || [];
                            const statusTds = table?.querySelectorAll('td[data-index]') || [];
                            for (let i = 0; i < items.length; i++) {
                                if (checkboxes[i]?.checked) {
                                    items[i].lastAttempt = true;
                                    const result = type === 'scenarios' ? await importScenario(items[i]) : { success: false, error: `Импорт ${type} не поддерживается` };
                                    items[i].status = result.success ? '✅' : '❌';
                                    if (!result.success) items[i].error = result.error;
                                } else {
                                    items[i].lastAttempt = false;
                                }
                                if (statusTds[i]) {
                                    statusTds[i].textContent = items[i].lastAttempt
                                        ? items[i].status
                                        : items[i].status === '✅'
                                        ? '✔'
                                        : items[i].status === '❌'
                                        ? '✖'
                                        : items[i].status;
                                    if (items[i].error) statusTds[i].title = items[i].error;
                                }
                            }
                        }

                        
                        lastImportedData.scenarios = scenariosData.scenarios;
                        lastImportedData.devices = devicesData.devices;
                        lastImportedData.groups = devicesData.groups;

                        // Сохраняем настройки импорта
                        importSettingsState = settingsContainer.cloneNode(true);
                        importSettingsState.querySelector('button').onclick = importSelectedButton.onclick;

                        // Отображаем результаты импорта
                        contentContainer.innerHTML = ''; // Очищаем содержимое
                        const resultsContainer = createDataTable(scenariosData, devicesData, devicesData, startTime, new Date() - startTime, file.name);
                        contentContainer.appendChild(resultsContainer);
                        importResultsState = resultsContainer.cloneNode(true); // Сохраняем результаты
                    } catch (error) {
                        console.error('[importSelectedButton] Ошибка:', error.message);
                        alert('Ошибка при импорте: ' + error.message);
                    } finally {
                        hideNotification();
                    }
                };

                contentContainer.appendChild(settingsContainer);
                importSettingsState = settingsContainer.cloneNode(true);
                importSettingsState.querySelector('button').onclick = importSelectedButton.onclick;

                hideNotification();
            } catch (error) {
                hideNotification();
                alert('Ошибка при парсинге YAML: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    const switchTab = (tabId) => {
        document.querySelectorAll('#custom-iot-content > div').forEach((tab) => (tab.style.display = tab.id === tabId ? 'block' : 'none'));
        document.querySelectorAll('#tab-buttons button').forEach((button) => {
            button.classList.toggle('active', button.dataset.tab === tabId);
            applyStyles(button, {
                ...STYLES.button,
                color: button.classList.contains('active') ? COLORS.buttonTextActive : COLORS.text,
                border: `1px solid ${COLORS.primary}`,
                backgroundColor: button.classList.contains('active') ? COLORS.primary : 'transparent',
            });
        });
    };

    const init = async () => {
        console.log('[init] Начало инициализации');
        const tabsContainer = await waitForElm('.waterfall-grid');
        console.log('[init] Найден tabsContainer:', tabsContainer);
        if (!tabsContainer) {
            console.error('[init] Элемент .waterfall-grid не найден');
            return;
        }

        let customContainer = document.querySelector('#custom-iot-container');
        if (!customContainer) {
            customContainer = document.createElement('div');
            customContainer.id = 'custom-iot-container';
            tabsContainer.insertAdjacentElement('afterend', customContainer);
        }

        // Стили для групп
        const groupStyles = {
            container: {
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${COLORS.primary}`,
                borderRadius: '10px',
                marginBottom: '15px',
                overflow: 'hidden',
            },
            header: {
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                padding: '5px 10px',
                color: COLORS.headingText, // Используем headingText для лучшей читаемости
                textAlign: 'center',
                borderRight: `1px solid ${COLORS.primary}`,
                borderTopLeftRadius: '10px',
                borderBottomLeftRadius: '10px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            },
            buttonContainer: {
                display: 'flex',
                alignItems: 'center',
            },
            button: {
                padding: '5px 10px',
                cursor: 'pointer',
                color: COLORS.text,
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${COLORS.primary}`,
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s',
            },
            lastButton: {
                borderTopRightRadius: '10px',
                borderBottomRightRadius: '10px',
            },
            label: {
                margin: '0 5px',
                color: COLORS.headingText, // Используем headingText для метки
                display: 'flex',
                alignItems: 'center',
            },
            input: {
                margin: '0 5px',
                padding: '5px',
                borderRadius: '5px',
                border: `1px solid ${COLORS.primary}`,
                color: COLORS.text,
                backgroundColor: 'transparent',
                height: '20px',
            },
        };

        // Обновляем стили для ховера
        const styleSheet = document.querySelector('style') || document.createElement('style');
        styleSheet.textContent += `
            .group-button:hover { background-color: rgba(106, 0, 255, 0.1) !important; }
            .group-input:hover { background-color: rgba(106, 0, 255, 0.05) !important; }
        `;
        document.head.appendChild(styleSheet);

        // Переменные для хранения данных
        let lastFetchedScenarios = null,
            lastFetchedDevices = null;

        // Контейнер для групп (два столбца)
        const groupsContainer = document.createElement('div');
        applyStyles(groupsContainer, {
            display: 'flex',
            gap: '20px',
            marginBottom: '15px',
        });

        const leftColumn = document.createElement('div');
        applyStyles(leftColumn, {
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
        });

        const rightColumn = document.createElement('div');
        applyStyles(rightColumn, {
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
        });

        groupsContainer.appendChild(leftColumn);
        groupsContainer.appendChild(rightColumn);
        customContainer.appendChild(groupsContainer);

        
        const contentContainer = document.createElement('div');
        contentContainer.id = 'custom-iot-content';
        applyStyles(contentContainer, STYLES.content);
        customContainer.appendChild(contentContainer);

        // Группа "Мой дом"
        const myHomeGroup = document.createElement('div');
        applyStyles(myHomeGroup, groupStyles.container);

        const myHomeHeader = document.createElement('div');
        myHomeHeader.textContent = 'Мой дом';
        applyStyles(myHomeHeader, groupStyles.header);
        myHomeGroup.appendChild(myHomeHeader);

        const myHomeButtonsContainer = document.createElement('div');
        applyStyles(myHomeButtonsContainer, groupStyles.buttonContainer);

        const myHomeButtons = [
            [
                'Посмотреть',
                async () => {
                    if (lastFetchedScenarios || lastFetchedDevices) {
                        // Данные уже есть, просто отображаем их
                        contentContainer.innerHTML = ''; // Очищаем содержимое
                        const scenariosData = lastFetchedScenarios ? { scenarios: lastFetchedScenarios.scenarios || [] } : { scenarios: [] };
                        const devicesData = lastFetchedDevices || { devices: [], groups: [] };
                        contentContainer.appendChild(createDataTable(scenariosData, devicesData, devicesData, new Date(), 0));
                    } else {
                        // Данных ещё нет, запрашиваем
                        const startTime = new Date();
                        const notification = showNotification('Получение данных...');
                        const [scenarios, devices] = await Promise.all([fetchScenarios(), fetchDevices()]);
                        hideNotification();
                        const scenariosData = { scenarios: (scenarios?.scenarios || []).map((s) => ({ ...s })) };
                        const devicesData = { devices: Object.values(devices?.devices || {}), groups: devices?.groups || [] };
                        contentContainer.innerHTML = ''; // Очищаем содержимое
                        contentContainer.appendChild(createDataTable(scenariosData, devicesData, devicesData, startTime, new Date() - startTime));
                        if (scenarios || devices) {
                            lastFetchedScenarios = scenarios;
                            lastFetchedDevices = devicesData;
                        }
                    }
                },
            ],
            [
                'Обновить',
                async () => {
                    const startTime = new Date();
                    const notification = showNotification('Получение данных...');
                    const [scenarios, devices] = await Promise.all([fetchScenarios(), fetchDevices()]);
                    hideNotification();
                    const scenariosData = { scenarios: (scenarios?.scenarios || []).map((s) => ({ ...s })) };
                    const devicesData = { devices: Object.values(devices?.devices || {}), groups: devices?.groups || [] };
                    contentContainer.innerHTML = ''; // Очищаем содержимое
                    contentContainer.appendChild(createDataTable(scenariosData, devicesData, devicesData, startTime, new Date() - startTime));
                    if (scenarios || devices) {
                        lastFetchedScenarios = scenarios;
                        lastFetchedDevices = devicesData;
                    }
                },
            ],
        ];

        myHomeButtons.forEach(([text, onclick], index) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'group-button';
            applyStyles(button, groupStyles.button);
            if (index === myHomeButtons.length - 1) {
                applyStyles(button, groupStyles.lastButton);
            }
            button.onclick = onclick;
            myHomeButtonsContainer.appendChild(button);
        });

        myHomeGroup.appendChild(myHomeButtonsContainer);
        leftColumn.appendChild(myHomeGroup);

        // Группа "Другое"
        const otherGroup = document.createElement('div');
        applyStyles(otherGroup, groupStyles.container);

        const otherHeader = document.createElement('div');
        otherHeader.textContent = 'Другое';
        applyStyles(otherHeader, groupStyles.header);
        otherGroup.appendChild(otherHeader);

        const otherButtonsContainer = document.createElement('div');
        applyStyles(otherButtonsContainer, groupStyles.buttonContainer);

        const otherButtons = [
            [
                'Очистить вкладку',
                () => {
                    contentContainer.innerHTML = '';
                    importSettingsState = null; // Очищаем состояние импорта
                    importResultsState = null;
                    lastImportedData = null;
                },
            ],
        ];

        otherButtons.forEach(([text, onclick], index) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'group-button';
            applyStyles(button, groupStyles.button);
            if (index === otherButtons.length - 1) {
                applyStyles(button, groupStyles.lastButton);
            }
            button.onclick = onclick;
            otherButtonsContainer.appendChild(button);
        });

        otherGroup.appendChild(otherButtonsContainer);
        leftColumn.appendChild(otherGroup);

        // Группа э кспорт
        const exportGroup = document.createElement('div');
        applyStyles(exportGroup, groupStyles.container);

        const exportHeader = document.createElement('div');
        exportHeader.textContent = 'Экспорт';
        applyStyles(exportHeader, groupStyles.header);
        exportGroup.appendChild(exportHeader);

        const exportButtonsContainer = document.createElement('div');
        applyStyles(exportButtonsContainer, groupStyles.buttonContainer);

        const exportButtons = [
            [
                'Настройки',
                () => {
                    if (!lastFetchedScenarios && !lastFetchedDevices) {
                        contentContainer.innerHTML = ''; // Очищаем содержимое
                        const header = document.createElement('h2');
                        header.textContent = 'Настройки экспорта';
                        applyStyles(header, { color: COLORS.headingText });
                        contentContainer.appendChild(header);
                        const message = document.createElement('p');
                        message.textContent = 'Нет данных для экспорта. Сначала получите данные с помощью кнопки "Посмотреть" или "Обновить".';
                        applyStyles(message, { color: COLORS.text });
                        contentContainer.appendChild(message);
                        return;
                    }

                    contentContainer.innerHTML = ''; // Очищаем содержимое
                    const header = document.createElement('h2');
                    header.textContent = 'Настройки экспорта';
                    applyStyles(header, { color: COLORS.headingText });
                    contentContainer.appendChild(header);

                    const scenariosData = lastFetchedScenarios
                        ? { scenarios: (lastFetchedScenarios.scenarios || []).map((s) => ({ ...s, status: '—', lastAttempt: false })) }
                        : { scenarios: [] };
                    const devicesData = lastFetchedDevices
                        ? {
                              devices: (lastFetchedDevices.devices ? Object.values(lastFetchedDevices.devices) : []).map((d) => ({
                                  ...d,
                                  status: '—',
                                  lastAttempt: false,
                              })),
                              groups: (lastFetchedDevices.groups || []).map((g) => ({ ...g, status: '—', lastAttempt: false })),
                          }
                        : { devices: [], groups: [] };

                    let scenariosTable, devicesTable, groupsTable;
                    if (scenariosData.scenarios.length) {
                        const container = createListContainer('Сценарии', scenariosData.scenarios, true, false);
                        scenariosTable = container.querySelector('table');
                        contentContainer.appendChild(container);
                    }
                    if (devicesData.devices.length) {
                        const container = createListContainer('Устройства', devicesData.devices, true, false);
                        devicesTable = container.querySelector('table');
                        contentContainer.appendChild(container);
                    }
                    if (devicesData.groups.length) {
                        const container = createListContainer('Группы', devicesData.groups, true, false);
                        groupsTable = container.querySelector('table');
                        contentContainer.appendChild(container);
                    }

                    const exportSelectedButton = document.createElement('button');
                    exportSelectedButton.textContent = 'Экспортировать выбранное';
                    applyStyles(exportSelectedButton, { ...STYLES.button, color: COLORS.text, border: `1px solid ${COLORS.primary}` });
                    contentContainer.appendChild(exportSelectedButton);

                    exportSelectedButton.onclick = () => {
                        const fileNameInput = document.querySelector('#export-file-name');
                        const fileName = fileNameInput?.value.trim() || 'iot_export';

                        const selectedScenarios = [];
                        const selectedDevices = [];
                        const selectedGroups = [];

                        if (scenariosData.scenarios.length) {
                            const checkboxes = scenariosTable.querySelectorAll('tbody input[type="checkbox"]');
                            scenariosData.scenarios.forEach((item, index) => {
                                if (checkboxes[index]?.checked) {
                                    selectedScenarios.push(item);
                                }
                            });
                        }
                        if (devicesData.devices.length) {
                            const checkboxes = devicesTable.querySelectorAll('tbody input[type="checkbox"]');
                            devicesData.devices.forEach((item, index) => {
                                if (checkboxes[index]?.checked) {
                                    selectedDevices.push(item);
                                }
                            });
                        }
                        if (devicesData.groups.length) {
                            const checkboxes = groupsTable.querySelectorAll('tbody input[type="checkbox"]');
                            devicesData.groups.forEach((item, index) => {
                                if (checkboxes[index]?.checked) {
                                    selectedGroups.push(item);
                                }
                            });
                        }

                        if (!selectedScenarios.length && !selectedDevices.length && !selectedGroups.length) {
                            alert('Выберите хотя бы один элемент для экспорта.');
                            return;
                        }

                        exportToYaml(
                            { devices: selectedDevices, groups: selectedGroups },
                            { scenarios: selectedScenarios },
                            fileName
                        );
                    };
                },
            ],
            [
                'Скачать',
                () => {
                    const fileNameInput = document.querySelector('#export-file-name');
                    const fileName = fileNameInput?.value.trim() || 'iot_export';
                    if (lastFetchedScenarios || lastFetchedDevices) {
                        exportToYaml(lastFetchedDevices, lastFetchedScenarios, fileName);
                    } else {
                        alert('Сначала получите данные.');
                    }
                },
            ],
        ];

        exportButtons.forEach(([text, onclick], index) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'group-button';
            applyStyles(button, groupStyles.button);
            if (index === exportButtons.length - 1) {
                applyStyles(button, groupStyles.lastButton);
            }
            button.onclick = onclick;
            exportButtonsContainer.appendChild(button);
        });

        // Добавляем метку и поле ввода имени файла
        const exportFileNameLabel = document.createElement('span');
        exportFileNameLabel.textContent = 'Имя файла для экспорта';
        applyStyles(exportFileNameLabel, groupStyles.label);
        exportButtonsContainer.appendChild(exportFileNameLabel);

        const exportFileNameInput = document.createElement('input');
        exportFileNameInput.id = 'export-file-name';
        exportFileNameInput.type = 'text';
        exportFileNameInput.placeholder = 'iot_export.yaml';
        exportFileNameInput.className = 'group-input';
        applyStyles(exportFileNameInput, groupStyles.input);
        exportButtonsContainer.appendChild(exportFileNameInput);

        exportGroup.appendChild(exportButtonsContainer);
        rightColumn.appendChild(exportGroup);

        // Группа "Импорт"
        const importGroup = document.createElement('div');
        applyStyles(importGroup, groupStyles.container);

        const importHeader = document.createElement('div');
        importHeader.textContent = 'Импорт';
        applyStyles(importHeader, groupStyles.header);
        importGroup.appendChild(importHeader);

        const importButtonsContainer = document.createElement('div');
        applyStyles(importButtonsContainer, groupStyles.buttonContainer);

        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.yaml,.yml';
        importInput.style.display = 'none';
        importInput.onchange = (e) => e.target.files.length && importFromYaml(e.target.files[0], contentContainer, importInput).then(() => (importInput.value = ''));
        customContainer.appendChild(importInput);

        const importButtons = [
            [
                'Настройки',
                () => {
                    contentContainer.innerHTML = ''; // Очищаем содержимое
                    if (lastImportedData) {
                        // Если данные уже загружены, восстанавливаем настройки
                        const scenariosData = { scenarios: lastImportedData.scenarios.map((s) => ({ ...s })) };
                        const devicesData = {
                            devices: lastImportedData.devices.map((d) => ({ ...d })),
                            groups: lastImportedData.groups.map((g) => ({ ...g })),
                        };
                        const settingsContainer = document.createElement('div');
                        const header = document.createElement('h2');
                        header.textContent = `Настройки импорта\nФайл: ${lastImportedData.fileName}`;
                        applyStyles(header, { color: COLORS.headingText, whiteSpace: 'pre-line' });
                        settingsContainer.appendChild(header);

                        let scenariosTable, devicesTable, groupsTable;
                        if (scenariosData.scenarios.length) {
                            const container = createListContainer('Сценарии', scenariosData.scenarios, true, false);
                            scenariosTable = container.querySelector('table');
                            settingsContainer.appendChild(container);
                        }
                        if (devicesData.devices.length) {
                            const container = createListContainer('Устройства', devicesData.devices, true, false);
                            devicesTable = container.querySelector('table');
                            settingsContainer.appendChild(container);
                        }
                        if (devicesData.groups.length) {
                            const container = createListContainer('Группы', devicesData.groups, true, false);
                            groupsTable = container.querySelector('table');
                            settingsContainer.appendChild(container);
                        }

                        const importSelectedButton = document.createElement('button');
                        importSelectedButton.textContent = 'Импортировать выбранное';
                        applyStyles(importSelectedButton, { ...STYLES.button, color: COLORS.text, border: `1px solid ${COLORS.primary}` });
                        settingsContainer.appendChild(importSelectedButton);

                        importSelectedButton.onclick = async () => {
                            const startTime = new Date();
                            const notification = showNotification('Импорт данных...');
                            try {
                                for (const [type, items, table] of [
                                    ['scenarios', scenariosData.scenarios, scenariosTable],
                                    ['devices', devicesData.devices, devicesTable],
                                    ['groups', devicesData.groups, groupsTable],
                                ]) {
                                    if (!items.length) continue;
                                    const checkboxes = table?.querySelectorAll('tbody input[type="checkbox"]') || [];
                                    const statusTds = table?.querySelectorAll('td[data-index]') || [];
                                    for (let i = 0; i < items.length; i++) {
                                        if (checkboxes[i]?.checked) {
                                            items[i].lastAttempt = true;
                                            const result =
                                                type === 'scenarios'
                                                    ? await importScenario(items[i])
                                                    : { success: false, error: `Импорт ${type} не поддерживается` };
                                            items[i].status = result.success ? '✅' : '❌';
                                            if (!result.success) items[i].error = result.error;
                                        } else {
                                            items[i].lastAttempt = false;
                                        }
                                        if (statusTds[i]) {
                                            statusTds[i].textContent = items[i].lastAttempt
                                                ? items[i].status
                                                : items[i].status === '✅'
                                                ? '✔'
                                                : items[i].status === '❌'
                                                ? '✖'
                                                : items[i].status;
                                            if (items[i].error) statusTds[i].title = items[i].error;
                                        }
                                    }
                                }

                                // Сохраняем настройки импорта
                                importSettingsState = settingsContainer.cloneNode(true);
                                importSettingsState.querySelector('button').onclick = importSelectedButton.onclick;

                                // Отображаем результаты импорта
                                contentContainer.innerHTML = ''; // Очищаем содержимое
                                const resultsContainer = createDataTable(
                                    scenariosData,
                                    devicesData,
                                    devicesData,
                                    startTime,
                                    new Date() - startTime,
                                    lastImportedData.fileName
                                );
                                contentContainer.appendChild(resultsContainer);
                                importResultsState = resultsContainer.cloneNode(true); // Сохраняем результаты
                            } catch (error) {
                                console.error('[importSelectedButton] Ошибка:', error.message);
                                alert('Ошибка при импорте: ' + error.message);
                            } finally {
                                hideNotification();
                            }
                        };

                        contentContainer.appendChild(settingsContainer);
                        importSettingsState = settingsContainer.cloneNode(true);
                        importSettingsState.querySelector('button').onclick = importSelectedButton.onclick;
                    } else {
                        const header = document.createElement('h2');
                        header.textContent = 'Настройки импорта';
                        applyStyles(header, { color: COLORS.headingText });
                        contentContainer.appendChild(header);
                        const message = document.createElement('p');
                        message.textContent = 'Выберите файл для импорта с помощью кнопки "Загрузить".';
                        applyStyles(message, { color: COLORS.text });
                        contentContainer.appendChild(message);
                    }
                },
            ],
            [
                'Результаты импорта',
                () => {
                    contentContainer.innerHTML = ''; // Очищаем содержимое
                    if (importResultsState) {
                        contentContainer.appendChild(importResultsState);
                    } else {
                        const header = document.createElement('h2');
                        header.textContent = 'Результаты импорта';
                        applyStyles(header, { color: COLORS.headingText });
                        contentContainer.appendChild(header);
                        const message = document.createElement('p');
                        message.textContent = 'Результаты импорта будут отображаться здесь после выполнения импорта.';
                        applyStyles(message, { color: COLORS.text });
                        contentContainer.appendChild(message);
                    }
                },
            ],
            ['Загрузить', () => importInput.click()],
        ];

        importButtons.forEach(([text, onclick], index) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'group-button';
            applyStyles(button, groupStyles.button);
            if (index === importButtons.length - 1) {
                applyStyles(button, groupStyles.lastButton);
            }
            button.onclick = onclick;
            importButtonsContainer.appendChild(button);
        });

        importGroup.appendChild(importButtonsContainer);
        rightColumn.appendChild(importGroup);

        updateTheme();
        new MutationObserver((mutations) => mutations.forEach((m) => m.attributeName === 'class' && updateTheme())).observe(document.documentElement, {
            attributes: true,
        });
        setTimeout(updateTheme, 1000);
        console.log('[init] Инициализация завершена');
    };

    console.log('[main] Старт');
    console.log('[main] jsyaml доступен:', typeof jsyaml);
    init().catch((error) => console.error('[init] Ошибка:', error.message));
})();
