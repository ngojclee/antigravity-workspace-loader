# Danh sách công việc (Task Checklist): Tính năng Quản lý Workspace

## Giai đoạn 1: Thiết lập & Cấu hình 
- [x] Thêm lệnh `workspaceLoader.openManager` vào `package.json`.
- [x] Thêm cấu hình `antigravityWorkspace.mainProjectRoot` (đường dẫn dự án chính) vào mục `configuration` trong `package.json`.
- [x] Thêm cấu hình `antigravityWorkspace.defaultAttachedDirectories` (các thư mục mặc định cần đính kèm) vào `configuration`.
- [x] Cập nhật `activationEvents` trong `package.json` để kích hoạt lệnh mới.

## Giai đoạn 2: Webview Provider & Cốt lõi giao diện 
- [x] Tạo module `WorkspaceManagerPanel.ts` phụ trách việc quản lý `vscode.WebviewPanel`.
- [x] Khai báo hàm `getHtmlForWebview` trả về nội dung HTML/CSS/JS.
- [x] Thực hiện cấu trúc giao diện:
  - Vùng hiển thị "Đường dẫn Project chính".
  - Nút "Chọn thư mục Project Gốc".
  - Giao diện cấu hình xem/chỉnh "Thư mục Đính kèm Mặc định".
  - Danh sách các file `.code-workspace` được tìm thấy.
  - Vùng "Tạo Workspace Mới" và form thiết lập.
  - Xử lý trạng thái UI và tạo phông cách/style.

## Giai đoạn 3: Logic Hoạt động (Giao tiếp Event & Xử lý File)
- [x] Viết chức năng nhận sự kiện `command: setMainProject` (hiển thị hộp thoại chọn thư mục cho VSCode).
- [x] Đọc danh sách file `.code-workspace` từ `[Project Chính]/.workspaces` và tải xuống Webview.
- [x] Viết chức năng xử lý `command: createWorkspace` (kết hợp thư mục được chọn + cấu hình mặc định, tạo ra json).
- [x] Trỏ nối lệnh `command: loadWorkspace` với chức năng tải workspace hiện tại của VSCode (dùng thư viện có sẵn).
- [x] Viết chức năng `command: copyPaths` (sao chép ra clipboard thông qua `vscode.env.clipboard`).

## Giai đoạn 4: Status Bar & Quick Switcher
- [x] Thêm file `WorkspaceSwitcher.ts` hoặc logic xử lý Status Bar trong `extension.ts`.
- [x] Lệnh `workspaceLoader.switchWorkspace`: Hiển thị Quick Pick menu lấy danh sách `.code-workspace` từ thư mục gốc.
- [x] Cập nhật Action Click trên Status Bar gọi tới lệnh `switchWorkspace`.
- [x] Khi chọn một mục từ Quick Pick, tự động thực thi module Load Workspace để load vào cửa sổ.

## Giai đoạn 5: Hoàn thiện & Ghi chú
- [x] Chặn các lỗi nhập liệu (thư mục không hợp lệ, phân loại tương đối/tuyệt đối).
- [x] Khắc phục lỗi tương thích version `@types/vscode` và `engines.vscode` để đóng gói extension.
- [x] Đóng gói thành công file `.vsix` mới nhất.
- [x] Cập nhật lại `task.md` theo tiến độ.
- [x] Cập nhật tài liệu hướng dẫn về workflow copy-paste vào Antigravity Agent Manager trong `README.md`.

## Giai đoạn 6: Tích hợp Activity Bar & Mở rộng tính năng thao tác nhanh
- [ ] Thiết lập Activity Bar (Side bar icon).
- [ ] Dời/Mở rộng Workspace Manager sang dạng `WebviewView` để tương thích ở Sidebar hoặc sử dụng dạng TreeView click mở panel.
- [ ] Lệnh `workspaceLoader.saveCurrentWorkspace` (Lưu đè cấu trúc workspace hiện thời sang file `.code-workspace` trong manager). Cần xử lý check file đã tồn tại và ask user to Overwrite.
- [ ] Lệnh `workspaceLoader.quickCreateWorkspace` (Tạo nhánh workspace siêu nhanh): mở Folder dialog tại `mainProjectRoot` -> tự động combine các thư mục mặc định -> sinh file mới & lưu vào `.workspaces` -> chuyển workspace.
- [ ] Cập nhật tài liệu và Release version.
