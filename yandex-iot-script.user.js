// ==UserScript==
// @name         Yandex IOT Scenario Fetcher
// @namespace    http://tampermonkey.net/
// @version      1.32
// @description  Получение, отображение, экспорт, импорт и удаление сценариев в Yandex IoT
// @author       Me
// @match        https://yandex.ru/iot/*
// @icon         https://yandex.ru/favicon.ico
// @grant        none
// @require      https://unpkg.com/js-yaml@4.1.0/dist/js-yaml.min.js
// ==/UserScript==

(function() {
    'use strict';

    const getTheme = () => document.documentElement.classList.contains('theme_dark') ? 'dark' : 'light';

    const THEMES = {
        light: { primary: '#6a00ff', accent: '#ff8c00', text: '#333333', buttonTextActive: '#ffffff', headingText: '#333333' },
        dark: { primary: '#a788ff', accent: '#ffd700', text: '#d3d3d3', buttonTextActive: '#333333', headingText: '#ffffff' }
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
            minHeight: '16px'
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
            boxShadow: `0 0 5px ${COLORS.primary}`
        },
        deleteIcon: { cursor: 'pointer', fontSize: '16px', padding: '2px' }
    };

    const applyStyles = (element, styles) => Object.assign(element.style, styles);

    const updateTheme = () => {
        COLORS = THEMES[getTheme()];
        STYLES.spinner.border = `3px solid ${COLORS.accent}`;
        STYLES.notification.backgroundColor = getTheme() === 'dark' ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        STYLES.notification.color = COLORS.text;
        STYLES.notification.boxShadow = `0 0 5px ${COLORS.primary}`;

        const container = document.querySelector('#custom-iot-container');
        if (container) {
            applyStyles(container, { ...STYLES.container, border: `1px solid ${COLORS.primary}`, color: COLORS.text, boxShadow: `0 0 10px ${COLORS.primary}` });

            container.querySelectorAll('button').forEach(button => {
                applyStyles(button, {
                    ...STYLES.button,
                    color: button.classList.contains('active') ? COLORS.buttonTextActive : COLORS.text,
                    border: `1px solid ${COLORS.primary}`,
                    backgroundColor: button.classList.contains('active') ? COLORS.primary : 'transparent'
                });
            });

            applyStyles(container.querySelector('#custom-iot-content'), STYLES.content);

            container.querySelectorAll('.list-container').forEach(list => {
                applyStyles(list, { ...STYLES.listContainer, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                applyStyles(list.querySelector('h3'), { color: COLORS.headingText });
                applyStyles(list.querySelector('table'), { ...STYLES.table, color: COLORS.text });
                list.querySelectorAll('th').forEach(th => applyStyles(th, { ...STYLES.th, border: `1px solid ${COLORS.primary}`, color: COLORS.text }));
                list.querySelectorAll('td').forEach(td => applyStyles(td, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text }));
                list.querySelectorAll('ul li').forEach(li => applyStyles(li, { color: COLORS.text }));
            });

            container.querySelectorAll('h2').forEach(h2 => applyStyles(h2, { color: COLORS.headingText }));
        }

        const notification = document.querySelector('#notification');
        if (notification) applyStyles(notification, STYLES.notification);
    };

    const styleSheet = document.createElement('style');
    styleSheet.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        #custom-iot-container button:hover { background-color: rgba(106, 0, 255, 0.1); }
        #custom-iot-container tr:hover td { background-color: rgba(106, 0, 255, 0.05); }`;
    document.head.appendChild(styleSheet);

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

    const formatDateTime = (date) => date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const createResultHeader = (startTime, duration, fileName = '') => {
        const header = document.createElement('h2');
        header.textContent = `${fileName ? 'Результат импорта данных' : 'Данные УДЯ'}${fileName ? `\nФайл: ${fileName}` : ''}\nНачало: ${formatDateTime(startTime)}\nЗавершено за: ${(duration / 1000).toFixed(2)} сек`;
        applyStyles(header, { color: COLORS.headingText, whiteSpace: 'pre-line' });
        return header;
    };

    const fetchData = async (url, method = 'GET', body = null) => {
        try {
            const csrfToken = window.storage?.csrfToken2 || '';
            const response = await fetch(url, {
                method,
                credentials: 'include',
                headers: { 'x-csrf-token': csrfToken, ...(body && { 'Content-Type': 'application/json' }) },
                body,
                timeout: 30000
            });
            if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
            const data = await response.json();
            return method === 'DELETE' ? data.status === 'ok' : data;
        } catch (error) {
            console.error(`[fetchData] Ошибка (${url}):`, error.message);
            return null;
        }
    };

    const fetchScenarios = () => fetchData('https://iot.quasar.yandex.ru/m/user/scenarios');
    const fetchDevices = () => fetchData('https://iot.quasar.yandex.ru/m/user/devices').then(data => ({
        devices: (data?.rooms?.flatMap(room => room.devices || []) || []).reduce((acc, device) => ({ ...acc, [device.id]: device }), {}),
        groups: data?.groups || []
    }));
    const deleteScenario = (id) => fetchData(`https://iot.quasar.yandex.ru/m/user/scenarios/${id}`, 'DELETE');
    const toggleScenarioActivation = (id, isActive) => fetchData(`https://iot.quasar.yandex.ru/m/user/scenarios/${id}/activation`, 'POST', JSON.stringify({ is_active: isActive }));

    const waitForElm = (selector) => new Promise(resolve => {
        const element = document.querySelector(selector);
        if (element) return resolve(element);
        const observer = new MutationObserver(() => {
            const found = document.querySelector(selector);
            if (found) { observer.disconnect(); resolve(found); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

    const createTableHeaders = (isSettingsTab, isResultsTab, table) => {
        const headers = isSettingsTab ? ['Выбрать', 'ID', 'Название', 'Тип/Иконка', 'Статус'] :
                       (isResultsTab ? ['ID', 'Название', 'Тип/Иконка', 'Статус'] :
                       ['ID', 'Название', 'Тип/Иконка', 'Вкл/выкл', 'Удалить']);
        const thead = document.createElement('thead');
        const row = document.createElement('tr');
        headers.forEach((text, index) => {
            const th = document.createElement('th');
            if (isSettingsTab && index === 0) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.addEventListener('change', () => table.querySelectorAll('tbody input[type="checkbox"]').forEach(cb => cb.checked = checkbox.checked));
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

    const createTableRows = (data, isSettingsTab, isResultsTab) => {
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
            [item.id || '—', item.name || 'Без названия', item.type || item.icon || '—'].forEach(text => {
                const td = document.createElement('td');
                td.textContent = text;
                applyStyles(td, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                row.appendChild(td);
            });
            const statusTd = document.createElement('td');
            if (isSettingsTab || isResultsTab) {
                statusTd.textContent = item.status || '—';
                if (item.lastAttempt === true) {
                    statusTd.textContent = item.status === '✅' ? '✅' : (item.status === '❌' ? '❌' : item.status);
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
                checkbox.checked = item.is_active !== false;
                checkbox.addEventListener('change', async () => {
                    const notification = showNotification('Переключение активности...');
                    const success = await toggleScenarioActivation(item.id, checkbox.checked);
                    hideNotification();
                    if (!success) checkbox.checked = !checkbox.checked;
                });
                statusTd.appendChild(checkbox);
            }
            applyStyles(statusTd, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
            row.appendChild(statusTd);

            if (!isSettingsTab && !isResultsTab) {
                const deleteTd = document.createElement('td');
                const deleteIcon = document.createElement('span');
                deleteIcon.textContent = '🗑️';
                deleteIcon.title = 'Удалить сценарий';
                applyStyles(deleteIcon, STYLES.deleteIcon);
                deleteIcon.onclick = async () => {
                    if (confirm(`Вы уверены, что хотите удалить сценарий "${item.name || item.id}"?`)) {
                        const notification = showNotification('Удаление сценария...');
                        const success = await deleteScenario(item.id);
                        hideNotification();
                        if (success) row.remove();
                    }
                };
                deleteTd.appendChild(deleteIcon);
                applyStyles(deleteTd, { ...STYLES.td, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
                row.appendChild(deleteTd);
            }
            tbody.appendChild(row);
        });
        return tbody;
    };

    const createImportTable = (data, isSettingsTab = false, isResultsTab = false) => {
        const table = document.createElement('table');
        applyStyles(table, { ...STYLES.table, color: COLORS.text });
        table.appendChild(createTableHeaders(isSettingsTab, isResultsTab, table));
        table.appendChild(createTableRows(data, isSettingsTab, isResultsTab));
        return table;
    };

    const createListContainer = (titleText, items, isSettingsTab, isResultsTab) => {
        const container = document.createElement('div');
        container.className = 'list-container';
        applyStyles(container, { ...STYLES.listContainer, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
        const title = document.createElement('h3');
        title.textContent = titleText;
        applyStyles(title, { color: COLORS.headingText });
        container.appendChild(title);
        container.appendChild(createImportTable(items, isSettingsTab, isResultsTab));
        return container;
    };

    const createDataTable = (scenarios, devices, groups, startTime, duration, fileName = '') => {
        const container = document.createElement('div');
        container.appendChild(createResultHeader(startTime, duration, fileName));
        const scenariosData = (scenarios?.scenarios || []).map(s => ({ ...s }));
        const devicesData = (devices?.devices ? Object.values(devices.devices) : []).map(d => ({ ...d }));
        const groupsData = (devices?.groups || []).map(g => ({ ...g }));

        if (scenariosData.length) container.appendChild(createListContainer('Сценарии', scenariosData, false, fileName !== ''));
        if (devicesData.length) container.appendChild(createListContainer('Устройства', devicesData, false, fileName !== ''));
        if (groupsData.length) container.appendChild(createListContainer('Группы', groupsData, false, fileName !== ''));

        const errors = [...scenariosData, ...devicesData, ...groupsData].filter(item => item.error).map(item => `${item.name || item.id}: ${item.error}`);
        if (errors.length) {
            const errorList = document.createElement('div');
            errorList.className = 'list-container';
            applyStyles(errorList, { ...STYLES.listContainer, border: `1px solid ${COLORS.primary}`, color: COLORS.text });
            const title = document.createElement('h3');
            title.textContent = 'Ошибки импорта';
            applyStyles(title, { color: COLORS.headingText });
            errorList.appendChild(title);
            const ul = document.createElement('ul');
            errors.forEach(error => {
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

    const exportToYaml = (devicesData, scenariosData) => {
        if (!devicesData?.devices?.length && !devicesData?.groups?.length && !scenariosData?.scenarios?.length) return alert('Нет данных для экспорта.');
        try {
            const exportData = { devices: devicesData?.devices || [], groups: devicesData?.groups || [], scenarios: scenariosData?.scenarios || [] };
            const yamlContent = jsyaml.dump(exportData);
            const blob = new Blob([yamlContent], { type: 'text/yaml' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'iot_export.yaml';
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
                triggers: scenario.triggers?.map(t => ({ trigger: { type: t.trigger?.type || 'scenario.trigger.timetable', value: t.trigger?.value || '12:00', slotId: t.trigger?.type || 'scenario.trigger.timetable' }, filters: [] })) || [{ trigger: { type: 'scenario.trigger.voice', value: 'Тест', slotId: 'scenario.trigger.voice' }, filters: [] }],
                steps: scenario.steps?.map(s => ({ type: s.type || 'scenarios.steps.actions.v2', parameters: { items: s.parameters?.items?.map(item => ({ id: item.id, type: item.type || 'step.action.item.device', value: { id: item.id, name: scenario.devices?.[0] || 'Устройство', type: 'devices.types.light', capabilities: [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: true, relative: false } }], directives: [], device_ids: [] } })) || [] } })) || [{ type: 'scenarios.steps.actions.v2', parameters: { items: [{ id: '3c9da082-24ae-4b08-8e3e-d6e1c002ded5', type: 'step.action.item.device', value: { id: '3c9da082-24ae-4b08-8e3e-d6e1c002ded5', name: 'Диммер розетковый', type: 'devices.types.light', capabilities: [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: true, relative: false } }], directives: [], device_ids: [] } }] } }],
                settings: { continue_execution_after_error: false }
            });
            const response = await fetch('https://iot.quasar.yandex.ru/m/v4/user/scenarios/', {
                method: 'POST',
                credentials: 'include',
                headers: { 'x-csrf-token': csrfToken, 'Content-Type': 'application/json' },
                body,
                timeout: 30000
            });
            if (!response.ok) throw new Error(`HTTP ошибка: ${response.status}`);
            return { success: true };
        } catch (error) {
            console.error('[importScenario] Ошибка:', error.message);
            return { success: false, error: error.message };
        }
    };

    const importFromYaml = async (file, importButton, contentContainer, importInput) => {
        const notification = showNotification('Загрузка файла...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = jsyaml.load(e.target.result);
                const scenariosData = { scenarios: (data.scenarios || []).map(s => ({ ...s, status: s.status || '—', lastAttempt: false })) };
                const devicesData = { devices: (data.devices || []).map(d => ({ ...d, status: d.status || '—', lastAttempt: false })), groups: (data.groups || []).map(g => ({ ...g, status: g.status || '—', lastAttempt: false })) };

                const settingsTab = contentContainer.querySelector('#settings-tab');
                settingsTab.innerHTML = '';
                const header = document.createElement('h2');
                header.textContent = `Настройки импорта\nФайл: ${file.name}`;
                applyStyles(header, { color: COLORS.headingText, whiteSpace: 'pre-line' });
                settingsTab.appendChild(header);

                if (scenariosData.scenarios.length) settingsTab.appendChild(createListContainer('Сценарии', scenariosData.scenarios, true, false));
                if (devicesData.devices.length) settingsTab.appendChild(createListContainer('Устройства', devicesData.devices, true, false));
                if (devicesData.groups.length) settingsTab.appendChild(createListContainer('Группы', devicesData.groups, true, false));

                const importSelectedButton = document.createElement('button');
                importSelectedButton.textContent = 'Импортировать выбранное';
                applyStyles(importSelectedButton, { ...STYLES.button, color: COLORS.text, border: `1px solid ${COLORS.primary}` });
                settingsTab.appendChild(importSelectedButton);

                importSelectedButton.onclick = async () => {
                    const startTime = new Date();
                    const notification = showNotification('Импорт данных...');
                    try {
                        for (const [type, items, table] of [['scenarios', scenariosData.scenarios, settingsTab.querySelector('.list-container:nth-child(2) table')], ['devices', devicesData.devices, settingsTab.querySelector('.list-container:nth-child(3) table')], ['groups', devicesData.groups, settingsTab.querySelector('.list-container:nth-child(4) table')]]) {
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
                                    statusTds[i].textContent = items[i].lastAttempt ? items[i].status : (items[i].status === '✅' ? '✔' : items[i].status === '❌' ? '✖' : items[i].status);
                                    if (items[i].error) statusTds[i].title = items[i].error;
                                }
                            }
                        }
                        displayData(contentContainer, scenariosData, devicesData, devicesData, startTime, new Date() - startTime, 'import-tab', file.name);
                        switchTab('import-tab');
                    } catch (error) {
                        console.error('[importSelectedButton] Ошибка:', error.message);
                    } finally {
                        hideNotification();
                    }
                };

                hideNotification();
                switchTab('settings-tab');
            } catch (error) {
                hideNotification();
                alert('Ошибка при парсинге YAML: ' + error.message);
            }
        };
        reader.readAsText(file);
    };

    const switchTab = (tabId) => {
        document.querySelectorAll('#custom-iot-content > div').forEach(tab => tab.style.display = tab.id === tabId ? 'block' : 'none');
        document.querySelectorAll('#tab-buttons button').forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
            applyStyles(button, {
                ...STYLES.button,
                color: button.classList.contains('active') ? COLORS.buttonTextActive : COLORS.text,
                border: `1px solid ${COLORS.primary}`,
                backgroundColor: button.classList.contains('active') ? COLORS.primary : 'transparent'
            });
        });
    };

    const init = async () => {
        const tabsContainer = await waitForElm('.waterfall-grid');
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

        const buttonContainer = document.createElement('div');
        customContainer.appendChild(buttonContainer);

        const buttons = [
            ['Получить данные', async () => {
                const startTime = new Date();
                const notification = showNotification('Получение данных...');
                const [scenarios, devices] = await Promise.all([fetchScenarios(), fetchDevices()]);
                hideNotification();
                const scenariosData = { scenarios: (scenarios?.scenarios || []).map(s => ({ ...s })) };
                const devicesData = { devices: Object.values(devices?.devices || {}), groups: devices?.groups || [] };
                displayData(contentContainer, scenariosData, devicesData, devicesData, startTime, new Date() - startTime, 'data-tab');
                switchTab('data-tab');
                if (scenarios || devices) { lastFetchedScenarios = scenarios; lastFetchedDevices = devicesData; }
            }],
            ['Экспорт в YAML', () => lastFetchedScenarios || lastFetchedDevices ? exportToYaml(lastFetchedDevices, lastFetchedScenarios) : alert('Сначала получите данные.')],
            ['Импорт из YAML', () => importInput.click()],
            ['Очистить вкладку', () => document.querySelector(`#${document.querySelector('#tab-buttons button.active').dataset.tab}`).innerHTML = '']
        ];

        let lastFetchedScenarios = null, lastFetchedDevices = null;
        const [fetchButton, exportButton, importButton, clearButton] = buttons.map(([text, onclick]) => {
            const button = document.createElement('button');
            button.textContent = text;
            applyStyles(button, { ...STYLES.button, color: COLORS.text, border: `1px solid ${COLORS.primary}` });
            button.onclick = onclick;
            buttonContainer.appendChild(button);
            return button;
        });

        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.yaml,.yml';
        importInput.style.display = 'none';
        importInput.onchange = (e) => e.target.files.length && importFromYaml(e.target.files[0], importButton, contentContainer, importInput).then(() => importInput.value = '');
        customContainer.appendChild(importInput);

        const tabButtons = document.createElement('div');
        tabButtons.id = 'tab-buttons';
        const tabData = [['Данные УДЯ', 'data-tab', true], ['Результаты импорта', 'import-tab', false], ['Настройки импорта', 'settings-tab', false]];
        tabData.forEach(([text, id, active]) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.dataset.tab = id;
            if (active) button.classList.add('active');
            applyStyles(button, {
                ...STYLES.button,
                color: active ? COLORS.buttonTextActive : COLORS.text,
                border: `1px solid ${COLORS.primary}`,
                backgroundColor: active ? COLORS.primary : 'transparent'
            });
            button.onclick = () => switchTab(id);
            tabButtons.appendChild(button);
        });
        customContainer.appendChild(tabButtons);

        const contentContainer = document.createElement('div');
        contentContainer.id = 'custom-iot-content';
        applyStyles(contentContainer, STYLES.content);
        tabData.forEach(([_, id, active]) => {
            const tab = document.createElement('div');
            tab.id = id;
            tab.style.display = active ? 'block' : 'none';
            contentContainer.appendChild(tab);
        });
        customContainer.appendChild(contentContainer);

        updateTheme();
        new MutationObserver((mutations) => mutations.forEach(m => m.attributeName === 'class' && updateTheme())).observe(document.documentElement, { attributes: true });
        setTimeout(updateTheme, 1000);
    };

    console.log('[main] Старт');
    init().catch(error => console.error('[init] Ошибка:', error.message));
})();