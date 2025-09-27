# PortPilot 🚀

A **production-ready, modular system monitoring application** built with Electron that runs in your macOS menu bar. PortPilot provides real-time monitoring of network ports and memory usage with an intuitive, user-friendly interface.

DOWNLOAD IT HERE - https://dub.sh/DEkjFNR



https://github.com/user-attachments/assets/331d9174-fcf3-4fca-83c7-f6832d4446e1

## ✨ Features

### 🔌 **Port Monitoring**
- **Real-time detection** of all active TCP listening ports
- **User-friendly descriptions** instead of raw process names
- **Process identification** with PID and service type
- **One-click process termination** for any port

### 💾 **Memory Monitoring**
- **Total system memory** usage display
- **Used vs. available** memory breakdown
- **Top memory consumers** with usage percentages
- **Process memory management** with kill functionality

### 🎨 **User Experience**
- **Menu bar integration** - no window needed
- **Contextual menus** with rich information
- **Template icons** for both light and dark themes
- **Graceful error handling** with fallbacks

## 🏗️ Architecture

PortPilot uses a **clean, modular architecture** for maintainability and extensibility:

```
portpilot/
├── src/                          # Main application code
│   ├── main.js                   # Application coordinator
│   └── utils/                    # Specialized modules
│       ├── system-info.js        # Port & memory detection
│       ├── process-manager.js    # Process operations
│       └── tray-manager.js       # UI and menu management
├── port-mapping.js               # Port-to-service descriptions
├── assets/                       # Icons and resources
├── main.js                       # Root entry point
├── package.json
├── preload.js
└── README.md
```

### **Module Breakdown:**

#### **`src/main.js`** - Application Coordinator
- Initializes Electron app
- Sets up IPC communication
- Manages application lifecycle
- Coordinates all utility modules

#### **`src/utils/system-info.js`** - System Monitoring
- `getPortsData()` - Detects active ports using `lsof`
- `getMemoryData()` - Memory usage with system totals
- `sh()` - Safe system command execution

#### **`src/utils/process-manager.js`** - Process Operations
- `killProcess()` - Terminate processes by PID
- `killPort()` - Kill all processes on a port
- `killPid()` - IPC handler for renderer communication

#### **`src/utils/tray-manager.js`** - UI Management
- `createTray()` - Creates system tray icon
- `updateTrayMenu()` - Dynamic menu updates
- `addViewData()` - Context-aware menu content

#### **`port-mapping.js`** - User-Friendly Descriptions
- Maps port numbers to natural language descriptions
- Extensible for new services and protocols
- Fallback to process names for unknown ports

## 🚀 Quick Start

### **Prerequisites**
- **macOS** (optimized for macOS menu bar)
- **Node.js** (for development)
- **sudo access** (for process management)

### **Installation & Running**

```bash
# Clone and navigate
git clone <repository-url>
cd portpilot

# Install dependencies
npm install

# Start the application
npm start
```

The app will appear in your **menu bar** (top-right on macOS). Click the orange circle icon to access all features.

## 📋 Usage

### **Port View** 🔌
- Shows all **active TCP listening ports**
- **User-friendly descriptions** (e.g., "Web Development Server" for port 3000)
- **Process information** with PID and service type
- **Kill processes** directly from the menu

### **Memory View** 💾
- **System memory overview** (Used/Total with percentage)
- **Top memory consumers** sorted by usage
- **Process details** with memory usage and percentage
- **Memory management** with one-click process termination

### **Menu Navigation**
- **View Toggle** - Switch between Ports and Memory views
- **Refresh** - Update data without closing menu
- **Kill Process** - Terminate any listed process
- **Quit** - Exit the application

## 🔧 Technical Details

### **Port Detection Strategy**
1. **Primary**: Regular `lsof` command
2. **Fallback**: `sudo lsof` for root processes
3. **Combining**: Merges results from both approaches
4. **Deduplication**: Removes duplicate entries

### **Memory Monitoring**
1. **Process scanning** using `ps` command
2. **System memory** detection via `system_profiler`
3. **Real-time calculations** of usage percentages
4. **Top consumers** sorted by memory usage

### **Process Management**
1. **Graceful termination** (SIGTERM)
2. **Force termination** (SIGKILL) for unresponsive processes
3. **Sudo fallback** for system processes
4. **Error handling** with user feedback

### **Icon System**
- **16x16 pixel** bitmap for optimal tray display
- **Template image** for macOS theme integration
- **Orange circle** design for visibility
- **Transparent background** for proper rendering

## 🛠️ Development

### **Adding New Port Descriptions**
Edit `port-mapping.js`:

```javascript
const PORT_DESCRIPTIONS = {
  // Add new mappings
  9000: 'Custom Service Name',
  // ... existing mappings
};
```

### **Extending Functionality**
1. **New modules** go in `src/utils/`
2. **Import** in `src/main.js`
3. **Add IPC handlers** for renderer communication
4. **Update menu** in `tray-manager.js`

### **Testing**
```bash
# Manual testing
npm start

# Check for common issues
# - Port 3000 detection
# - Memory calculations
# - Process killing
# - Menu switching
```

## 🔒 Security & Permissions

- **Sudo access required** for process management
- **System command execution** with proper error handling
- **Process isolation** using Electron's security model
- **No external network access** (local system only)

## 🐛 Troubleshooting

### **Tray Icon Not Visible**
- Check Console.app for errors
- Verify Electron installation
- Restart the application

### **Ports Not Detected**
- Ensure `lsof` command is available
- Check sudo permissions
- Verify processes are actually running

### **Memory Data Issues**
- Confirm `ps` and `system_profiler` access
- Check for permission restrictions
- Verify system memory detection

### **Process Killing Fails**
- Check sudo configuration
- Verify process ownership
- Confirm signal handling

## 📈 Performance

- **Lightweight** - Minimal system resource usage
- **Efficient** - Cached data with manual refresh
- **Responsive** - Sub-second menu updates
- **Memory efficient** - Proper cleanup and garbage collection

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Add** your improvements
4. **Test** thoroughly
5. **Submit** a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

**PortPilot** - Your friendly neighborhood system monitor 🖥️✨
