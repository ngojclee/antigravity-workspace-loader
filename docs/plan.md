# Kế hoạch & Nghiên cứu (Nghiên cứu & Lập kế hoạch - Trình quản lý Workspace)

## 1. Ngữ cảnh & Mục tiêu
Người dùng đang gặp khó khăn trong việc quản lý các workspace đa thư mục trên Antigravity Agent Manager. Hệ thống bị mất kết nối giữa các cuộc hội thoại và tập hợp thư mục (workspace) tương ứng, dẫn đến việc phải cấu hình lại thường xuyên.

**Mục tiêu:**
1. Cấu trúc lại extension `antigravity-workspace-loader` trên VSCode để tích hợp thêm một "Workspace Manager" Panel giao diện trực quan.
2. Cho phép thiết lập thư mục gốc của dự án chính (Main Project Root). Thư mục gốc này sẽ chứa một thư mục ẩn `.workspaces`.
3. Hỗ trợ tạo các Workspace con (Sub-workspaces) bao gồm:
   - Một thư mục làm việc chính.
   - Các thư mục đính kèm mặc định (ví dụ: `docs`, `config`, shared libs...).
4. Cung cấp một giao diện Webview Panel để người dùng dễ dàng xem, chỉnh sửa các workspace này và **sao chép đường dẫn tuyệt đối của các thư mục**. Việc này giúp người dùng dễ dàng dán vào Antigravity Agent Manager hoặc các hộp thoại tiêu chuẩn.
5. Cung cấp cơ chế tự động đồng bộ/phát sinh: Lấy ngữ cảnh thư mục hiện tại + nối thêm các thư mục mặc định -> lưu lại thành cấu hình JSON (`.code-workspace`) vào thư mục `.workspaces`.
6. Tính năng hiển thị menu dưới thanh trạng thái (Status Bar) để người dùng có thể nhấp vào và chọn danh sách các workspace, thực hiện chuyển đổi (chuyển workspace) cực kỳ nhanh gọn ngay trên VSCode.

## 2. Kiến trúc dự kiến
- **VSCode Webview Panel:** Một giao diện React hoặc HTML/JS thuần chạy bên trong Webview.
- **Data Persistence:** Lưu trữ cấu hình (đường dẫn Project chính, danh sách thư mục mặc định) thông qua Settings của VSCode, đồng thời lưu các setup workspace vật lý dưới dạng file `.code-workspace` JSON trong mục `.workspaces/`.
- **Core Commands (Các lệnh chính):**
  - `workspaceLoader.openManager`: Mở giao diện Webview quản lý.
  - `workspaceLoader.copyPaths`: Sao chép các đường dẫn thư mục của một workspace.
  - `workspaceLoader.generateWorkspace`: Kết hợp thư mục gốc được chọn + các thư mục mặc định -> lưu vào `.workspaces`.

## 3. Các giai đoạn triển khai

### Giai đoạn 1: Cấu trúc cơ bản & Cấu hình (VSCode)
- Thêm các lệnh mới vào `package.json` (`openManager`).
- Thiết lập cấu hình extension trong `contributes.configuration` để người dùng xác định "Danh sách thư mục mặc định" (chuỗi văn bản) và "Thư mục Project gốc".

### Giai đoạn 2: Triển khai Giao diện Webview
- Xây dựng file HTML/JS cho Webview.
- Tính năng:
  - Hiển thị đường dẫn Project chính hiện tại.
  - Hiển thị danh sách các file `.code-workspace` tìm thấy trong `[MainProject]/.workspaces/`.
  - Form tạo workspace mới: Chọn thư mục chính, chọn danh sách thư mục mặc định, tạo ra một file `.code-workspace`.
  - Nút thao tác nhanh trên mỗi workspace: **"Tải vào VSCode"** và **"Copy Đường Dẫn"**.

### Giai đoạn 3: Logic Hoạt động & Giao tiếp Webview
- Giao tiếp dữ liệu (Message Passing) giữa Webview và Extension để đọc/ghi file và clipboard.
  - Sử dụng `vscode.env.clipboard.writeText` để phục vụ chức năng sao chép.
  - Xử lý đọc và tạo file json trong thư mục `.workspaces`.

### Giai đoạn 4: Status Bar & Quick Switcher (Chuyển đổi nhanh)
- Khởi tạo phần tử trên Status Bar (Thanh trạng thái dưới đáy VSCode).
- Hiển thị tên Workspace trực quan (hoặc nút "Switch Workspace").
- Khi nhấn vào Status Bar: Hiển thị Quick Pick menu (`vscode.window.showQuickPick`) chứa toàn bộ danh sách `.code-workspace` đang tồn tại trong thư mục `.workspaces`.
- Khi chọn 1 mục -> tự động gọi lệnh Load Workspace để thay thế các thư mục trong cửa sổ VSCode hiện tại.

### Giai đoạn 5: Kiểm thử & Hoàn thiện
- Đảm bảo xử lý lỗi nếu đường dẫn không tồn tại.
- Chuẩn hóa định dạng đường dẫn cho Antigravity Agent Manager.
- Cập nhật tài liệu hướng dẫn trong `README.md`.
