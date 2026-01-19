const fs = require('fs');
const path = require('path');

// --- CẤU HÌNH ---
const OUTPUT_FILE = 'code_context.txt';

// Các thư mục sẽ BỎ QUA (Không quét)
const IGNORE_DIRS = [
    'node_modules',
    '.git',
    '.vscode',
    'dist',
    'build',
    'coverage',
    'logs',
    'temp',
    // --- Các thư mục tài nguyên/data bạn yêu cầu bỏ qua ---
    'custom_reply',
    'data',
    'cards',
    'pictures'
];

// Các file sẽ BỎ QUA
const IGNORE_FILES = [
    'package-lock.json',
    'yarn.lock',
    '.env',
    '.DS_Store',
    OUTPUT_FILE, // Bỏ qua chính file output
    'repomix-output.xml',
    'export_code.js' // Bỏ qua chính script này
];

// Các đuôi file sẽ BỎ QUA (File ảnh, binary...)
const IGNORE_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
    '.mp3', '.mp4', '.wav',
    '.pdf', '.exe', '.dll', '.bin', '.dat',
    '.sqlite', '.db'
];

/**
 * Hàm kiểm tra xem có nên bỏ qua file/folder không
 */
function shouldIgnore(entryName, isDirectory = false) {
    if (IGNORE_DIRS.includes(entryName) && isDirectory) return true;
    if (IGNORE_FILES.includes(entryName) && !isDirectory) return true;
    
    if (!isDirectory) {
        const ext = path.extname(entryName).toLowerCase();
        if (IGNORE_EXTENSIONS.includes(ext)) return true;
    }
    return false;
}

/**
 * Hàm vẽ cây thư mục (Tree Structure)
 */
function generateTree(dir, prefix = '') {
    let treeString = '';
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    // Lọc bỏ các file/folder nằm trong ignore list
    const filteredEntries = entries.filter(entry => !shouldIgnore(entry.name, entry.isDirectory()));

    filteredEntries.forEach((entry, index) => {
        const isLast = index === filteredEntries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        
        treeString += `${prefix}${connector}${entry.name}\n`;
        
        if (entry.isDirectory()) {
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            treeString += generateTree(path.join(dir, entry.name), childPrefix);
        }
    });
    return treeString;
}

/**
 * Hàm đọc nội dung file đệ quy
 */
function scanFiles(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (shouldIgnore(entry.name, entry.isDirectory())) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            scanFiles(fullPath, fileList);
        } else {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

// --- CHẠY CHƯƠNG TRÌNH ---
console.log("🚀 Đang tiến hành quét project...");

try {
    const rootDir = process.cwd(); // Thư mục hiện tại
    let outputContent = "";

    // 1. Tạo Header
    outputContent += "================================================================================\n";
    outputContent += `PROJECT EXPORT: ${path.basename(rootDir)}\n`;
    outputContent += `DATE: ${new Date().toLocaleString()}\n`;
    outputContent += "================================================================================\n\n";

    // 2. Tạo Tree Structure
    console.log("📂 Đang tạo cây thư mục...");
    outputContent += "--- DIRECTORY STRUCTURE ---\n";
    outputContent += generateTree(rootDir);
    outputContent += "\n\n";

    // 3. Đọc nội dung từng file
    console.log("📝 Đang đọc nội dung file...");
    const allFiles = scanFiles(rootDir);

    allFiles.forEach(filePath => {
        // Lấy đường dẫn tương đối để hiển thị cho đẹp
        const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
        
        outputContent += "================================================================================\n";
        outputContent += `FILE: ${relativePath}\n`;
        outputContent += "================================================================================\n";
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            outputContent += content + "\n\n";
        } catch (err) {
            outputContent += `[ERROR READING FILE]: ${err.message}\n\n`;
        }
    });

    // 4. Ghi ra file kết quả
    fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
    console.log(`✅ XONG! Đã xuất code ra file: ${OUTPUT_FILE}`);
    console.log(`👉 Bạn có thể gửi file này cho AI để được hỗ trợ tốt nhất.`);

} catch (error) {
    console.error("❌ Có lỗi xảy ra:", error);
}