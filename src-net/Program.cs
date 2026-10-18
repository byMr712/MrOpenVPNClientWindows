using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace MrOpenVPNClient;

internal static class Program
{
    [DllImport("shell32.dll", SetLastError = true)]
    private static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern uint RegisterWindowMessage(string lpString);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", EntryPoint = "FindWindow", SetLastError = true, CharSet = CharSet.Auto)]
    private static extern IntPtr FindWindow(string? lpClassName, string lpWindowName);

    [DllImport("user32.dll")]
    private static extern bool AllowSetForegroundWindow(int dwProcessId);

    private const int ASFW_ANY = -1;
    public const string MainWindowTitle = "MrOpenVPN Client For Windows";
    public const string ShowEventName = "Local\\MrOpenVPNClientWindows_ShowEvent";

    public const int HWND_BROADCAST = 0xffff;
    public static readonly uint WM_SHOW_MROPENVPN = RegisterWindowMessage("WM_SHOW_MROPENVPN_CLIENT_WINDOW");

    private static Mutex? _singleInstanceMutex;

    [STAThread]
    private static void Main()
    {
        try
        {
            SetCurrentProcessExplicitAppUserModelID("byMr712.MrOpenVPNClient.Windows");
        }
        catch { }

        const string mutexName = "Global\\MrOpenVPNClientWindows_SingleInstance";
        _singleInstanceMutex = new Mutex(true, mutexName, out bool isNewInstance);

        if (!isNewInstance)
        {
            // Allow the running instance to take foreground focus
            AllowSetForegroundWindow(ASFW_ANY);

            // Signal named event to notify the active instance
            try
            {
                using var ev = EventWaitHandle.OpenExisting(ShowEventName);
                ev.Set();
            }
            catch { }

            // Also post message directly to window handle if found
            var hWnd = FindWindow(null, MainWindowTitle);
            if (hWnd != IntPtr.Zero)
            {
                PostMessage(hWnd, WM_SHOW_MROPENVPN, IntPtr.Zero, IntPtr.Zero);
            }
            else
            {
                PostMessage((IntPtr)HWND_BROADCAST, WM_SHOW_MROPENVPN, IntPtr.Zero, IntPtr.Zero);
            }
            return;
        }

        EventWaitHandle? showEvent = null;
        RegisteredWaitHandle? waitHandle = null;
        try
        {
            showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowEventName);
        }
        catch { }

        ApplicationConfiguration.Initialize();
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var mainForm = new MainForm();

        if (showEvent != null)
        {
            waitHandle = ThreadPool.RegisterWaitForSingleObject(
                showEvent,
                (state, timedOut) =>
                {
                    if (!timedOut && !mainForm.IsDisposed)
                    {
                        mainForm.RestoreAndShowWindow();
                    }
                },
                null,
                -1,
                false);
        }

        Application.Run(mainForm);

        waitHandle?.Unregister(null);
        showEvent?.Dispose();
        GC.KeepAlive(_singleInstanceMutex);
    }
}
