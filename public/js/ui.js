function renderTableMessage(container, message, columnCount, state) {
    const row = document.createElement('tr');
    row.dataset.state = state;
    const cell = document.createElement('td');
    cell.colSpan = columnCount;
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    cell.textContent = message;
    row.appendChild(cell);
    container.replaceChildren(row);
}

export function showLoading(container, message = 'Đang tải dữ liệu...', columnCount = 1) {
    renderTableMessage(container, message, columnCount, 'loading');
}

export function showError(container, error, columnCount = 1) {
    const message = error instanceof Error ? error.message : String(error);
    renderTableMessage(container, `Lỗi tải dữ liệu: ${message}`, columnCount, 'error');
}

export function showEmpty(container, message = 'Không có dữ liệu.', columnCount = 1) {
    renderTableMessage(container, message, columnCount, 'empty');
}

export function showSuccess(container, message) {
    container.textContent = message;
    container.dataset.state = 'success';
}

export function setBusy(button, busy, busyLabel = 'Đang xử lý...') {
    if (busy) {
        if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = busyLabel;
        return;
    }
    button.disabled = false;
    if (button.dataset.originalLabel) {
        button.textContent = button.dataset.originalLabel;
        delete button.dataset.originalLabel;
    }
}
