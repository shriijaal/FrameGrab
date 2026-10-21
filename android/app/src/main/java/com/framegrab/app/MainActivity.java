package com.framegrab.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.view.Window;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Thin WebView shell for the Framegrab web app (index.html is bundled as an
 * asset and served under a fake https origin so IndexedDB, clipboard and
 * getUserMedia behave exactly like in desktop Chrome).
 */
public class MainActivity extends Activity {
    private static final String TAG = "Framegrab";
    private static final String HOST = "appassets.framegrab.local";
    private static final int FILE_CHOOSER = 101;
    private static final int PERM_CAMERA = 102;
    private static final int PERM_STORAGE = 103;
    private static final int RQ_SAVE = 104;
    private static final int RQ_FOLDER = 105;

    private WebView web;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingCamReq;
    private String pendName, pendMime, pendData;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The status bar is transparent: the page's own background shows through
        // it, and the page pads itself by the bar's height (pushed in as --sbt).
        Window win = getWindow();
        win.setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            win.setDecorFitsSystemWindows(false);
        } else {
            win.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
        web = new WebView(this);
        setContentView(web);
        web.setBackgroundColor(Color.TRANSPARENT);
        pushInsets();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (u != null && "https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return serveAsset(r.getUrl());
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) Log.e(TAG, "page error: " + e.getDescription());
            }
            @Override public void onPageFinished(WebView v, String url) {
                pushInsets();
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                            pendingCamReq = request;
                            ensureCamera();
                        } else {
                            request.deny();
                        }
                    }
                });
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                }
                filePathCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String type = "*/*";
                String[] accept = params.getAcceptTypes();
                if (accept != null && accept.length == 1 && accept[0] != null
                        && !accept[0].isEmpty() && !accept[0].contains(",")) {
                    type = accept[0];
                }
                i.setType(type);
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(i, FILE_CHOOSER);
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    Log.w(TAG, "console: " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                }
                return true;
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                                  String mimeType, long contentLength) {
                handleDownload(url, contentDisposition, userAgent, mimeType);
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        if (Build.VERSION.SDK_INT < 29
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, PERM_STORAGE);
        }

        String url = "https://" + HOST + "/index.html";
        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        }
        if (web.getUrl() == null) {
            web.loadUrl(url);
        }
    }

    /* ---------------- asset serving (fake https origin) ---------------- */

    private WebResourceResponse serveAsset(Uri u) {
        if (u == null || !"https".equals(u.getScheme()) || u.getHost() == null || !HOST.equals(u.getHost())) {
            return null;
        }
        String p = u.getPath();
        if (p == null || p.isEmpty() || p.equals("/")) p = "/index.html";
        String asset = p.startsWith("/") ? p.substring(1) : p;
        try {
            InputStream in = getAssets().open(asset);
            String mime = mimeFor(asset);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            // Cross-origin isolation lets the ONNX runtime use SharedArrayBuffer (multi-threaded inference).
            headers.put("Cross-Origin-Opener-Policy", "same-origin");
            headers.put("Cross-Origin-Embedder-Policy", "credentialless");
            String encoding = mime.startsWith("text/") || mime.contains("javascript") ? "UTF-8" : null;
            return new WebResourceResponse(mime, encoding, 200, "OK", headers, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null,
                    new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mimeFor(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.US) : "";
        switch (ext) {
            case "html": return "text/html";
            case "js": return "text/javascript";
            case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "wasm": return "application/wasm";
            case "json": return "application/json";
            default: return "application/octet-stream";
        }
    }

    /* ---------------- camera (getUserMedia) ---------------- */

    private void ensureCamera() {
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            grantCam();
        } else {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, PERM_CAMERA);
        }
    }

    private void grantCam() {
        if (pendingCamReq != null) {
            pendingCamReq.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            pendingCamReq = null;
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] grants) {
        boolean ok = grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED;
        if (code == PERM_CAMERA) {
            if (ok) {
                grantCam();
            } else if (pendingCamReq != null) {
                pendingCamReq.deny();
                pendingCamReq = null;
            }
        } else if (code == PERM_STORAGE && !ok) {
            toast("Allow storage access so files can be saved to Downloads");
        }
    }

    /* ---------------- file chooser ---------------- */

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && filePathCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData cd = data.getClipData();
                if (cd != null && cd.getItemCount() > 0) {
                    result = new Uri[cd.getItemCount()];
                    for (int i = 0; i < cd.getItemCount(); i++) {
                        result[i] = cd.getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        } else if (requestCode == RQ_FOLDER) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri tree = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(tree,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (Exception e) {
                    Log.w(TAG, "persist permission failed", e);
                }
                prefs().edit().putString("folder", tree.toString()).apply();
                final String nm = lastSegment(tree);
                if (pendData != null) {
                    String n = pendName, m = pendMime, d = pendData;
                    pendData = null;
                    saveToTree(tree, n, m, d);
                } else if (web != null) {
                    web.evaluateJavascript("typeof folderPicked==='function'&&folderPicked(" + jsq(nm) + ")", null);
                }
            } else {
                pendData = null;
            }
        } else if (requestCode == RQ_SAVE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendData != null) {
                try {
                    OutputStream os = getContentResolver().openOutputStream(data.getData());
                    if (os == null) throw new IllegalStateException("could not open output stream");
                    os.write(decodeData(pendData));
                    os.close();
                    toast("Saved");
                } catch (Exception e) {
                    Log.e(TAG, "saveDialog failed", e);
                    toast("Save failed: " + e.getMessage());
                }
            }
            pendData = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    /* ---------------- save location (Storage Access Framework) ---------------- */

    private SharedPreferences prefs() {
        return getSharedPreferences("fg", MODE_PRIVATE);
    }

    private static byte[] decodeData(String dataUrl) {
        if (dataUrl == null) throw new IllegalArgumentException("bad payload");
        int comma = dataUrl.indexOf(',');
        if (comma < 0) throw new IllegalArgumentException("bad payload");
        return Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
    }

    private static String lastSegment(Uri u) {
        String lp = u.getLastPathSegment();
        if (lp == null) return "folder";
        int i = lp.lastIndexOf(':');
        String s = i >= 0 ? lp.substring(i + 1) : lp;
        int j = s.lastIndexOf('/');
        return j >= 0 ? s.substring(j + 1) : s;
    }

    private void saveToTree(Uri tree, String name, String mime, String dataUrl) {
        try {
            byte[] bytes = decodeData(dataUrl);
            final String safe = sanitize(name == null || name.isEmpty() ? "download.bin" : name);
            String m = (mime == null || mime.isEmpty()) ? guessMime(safe) : mime;
            Uri doc = DocumentsContract.createDocument(getContentResolver(), tree, m, safe);
            if (doc == null) doc = DocumentsContract.createDocument(
                    getContentResolver(), tree, "application/octet-stream", safe);
            if (doc == null) throw new IllegalStateException("could not create the file");
            OutputStream os = getContentResolver().openOutputStream(doc);
            if (os == null) throw new IllegalStateException("could not open output stream");
            os.write(bytes);
            os.close();
            final String folder = lastSegment(tree);
            runOnUiThread(new Runnable() {
                @Override public void run() { toast("Saved to " + folder + "/" + safe); }
            });
        } catch (final Exception e) {
            Log.e(TAG, "saveToTree failed", e);
            runOnUiThread(new Runnable() {
                @Override public void run() { toast("Save failed: " + e.getMessage()); }
            });
        }
    }

    /* ---------------- downloads ---------------- */

    private void handleDownload(String url, String contentDisposition, String userAgent, String mimeType) {
        if (url.startsWith("blob:")) {
            String name = pickName(contentDisposition, url);
            String js = "(function(){fetch(" + jsq(url) + ").then(function(r){return r.blob()})"
                    + ".then(function(b){var f=new FileReader();"
                    + "f.onload=function(){Android.saveFile(" + jsq(name) + ", f.result)};"
                    + "f.readAsDataURL(b)})"
                    + ".catch(function(e){Android.log('download failed: '+e)})})()";
            web.evaluateJavascript(js, null);
            return;
        }
        try {
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            if (mimeType != null) req.setMimeType(mimeType);
            req.addRequestHeader("User-Agent", userAgent);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            String name = pickName(contentDisposition, url);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            dm.enqueue(req);
            toast("Downloading " + name);
        } catch (Exception e) {
            Log.e(TAG, "download failed", e);
            toast("Download failed");
        }
    }

    private static final Pattern FILENAME_RE =
            Pattern.compile("filename\\*?=(?:UTF-8'')?[\"']?([^\"';]+)", Pattern.CASE_INSENSITIVE);

    private static String pickName(String disp, String url) {
        String n = null;
        if (disp != null) {
            Matcher m = FILENAME_RE.matcher(disp);
            if (m.find()) n = m.group(1).trim();
        }
        if (n == null || n.isEmpty()) {
            String last = Uri.parse(url).getLastPathSegment();
            if (last != null && !last.isEmpty() && !last.equals("null")) n = last;
        }
        if (n == null || n.isEmpty()) n = "download-" + System.currentTimeMillis();
        return sanitize(n);
    }

    private static String sanitize(String n) {
        String s = n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (s.isEmpty() || s.equals(".") || s.equals("..")) s = "download.bin";
        return s;
    }

    private static String base(String n) {
        int d = n.lastIndexOf('.');
        return d >= 0 ? n.substring(0, d) : n;
    }

    private static String ext(String n) {
        int d = n.lastIndexOf('.');
        return d >= 0 ? n.substring(d) : "";
    }

    private static String guessMime(String n) {
        String e = MimeTypeMap.getFileExtensionFromUrl(n.replace(' ', '_'));
        String m = (e == null || e.isEmpty())
                ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(e.toLowerCase(Locale.US));
        return m == null ? "application/octet-stream" : m;
    }

    private static String jsq(String s) {
        StringBuilder b = new StringBuilder("'");
        for (char c : s.toCharArray()) {
            if (c == '\\' || c == '\'') b.append('\\').append(c);
            else if (c == '\n') b.append("\\n");
            else if (c == '\r') b.append("\\r");
            else b.append(c);
        }
        return b.append('\'').toString();
    }

    /* ---------------- JS bridge ---------------- */

    public class Bridge {
        @JavascriptInterface public void saveFile(final String name, final String dataUrl) {
            try {
                int comma = dataUrl == null ? -1 : dataUrl.indexOf(',');
                if (comma < 0) throw new IllegalArgumentException("bad payload");
                String meta = dataUrl.substring(0, comma);
                String mime = meta.startsWith("data:") ? meta.substring(5) : "";
                int sc = mime.indexOf(';');
                if (sc >= 0) mime = mime.substring(0, sc);
                byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
                final String safe = sanitize(name == null || name.isEmpty() ? "download.bin" : name);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                    cv.put(MediaStore.Downloads.MIME_TYPE, mime.isEmpty() ? guessMime(safe) : mime);
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    cv.put(MediaStore.Downloads.IS_PENDING, 1);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) throw new IllegalStateException("could not create download entry");
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) throw new IllegalStateException("could not open output stream");
                    os.write(bytes);
                    os.close();
                    cv.clear();
                    cv.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, cv, null, null);
                    runOnUiThread(new Runnable() {
                        @Override public void run() { toast("Saved to Downloads/" + safe); }
                    });
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            != PackageManager.PERMISSION_GRANTED) {
                        throw new IllegalStateException("storage permission denied");
                    }
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("could not create Downloads");
                    File f = new File(dir, safe);
                    int i = 1;
                    while (f.exists()) {
                        f = new File(dir, base(safe) + " (" + (i++) + ")" + ext(safe));
                    }
                    final File out = f;
                    FileOutputStream fo = new FileOutputStream(out);
                    fo.write(bytes);
                    fo.close();
                    runOnUiThread(new Runnable() {
                        @Override public void run() { toast("Saved to Downloads/" + out.getName()); }
                    });
                }
            } catch (final Exception e) {
                Log.e(TAG, "saveFile failed", e);
                runOnUiThread(new Runnable() {
                    @Override public void run() { toast("Save failed: " + e.getMessage()); }
                });
            }
        }

        @JavascriptInterface public void log(String m) {
            Log.i(TAG, "js: " + m);
        }

        // Real system day/night state — the WebView's prefers-color-scheme can lag
        // behind a live theme switch, so the page asks Android directly.
        @JavascriptInterface public boolean isDark() {
            return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                    == Configuration.UI_MODE_NIGHT_YES;
        }

        @JavascriptInterface public void saveFolder(String name, String mime, String dataUrl) {
            String tree = prefs().getString("folder", null);
            if (tree == null) {
                pendName = name;
                pendMime = mime;
                pendData = dataUrl;
                pickFolder();
                return;
            }
            saveToTree(Uri.parse(tree), name, mime, dataUrl);
        }

        @JavascriptInterface public void saveDialog(String name, String mime, String dataUrl) {
            pendName = name;
            pendMime = mime;
            pendData = dataUrl;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(mime == null || mime.isEmpty() ? "*/*" : mime);
            i.putExtra(Intent.EXTRA_TITLE, sanitize(name == null ? "download.bin" : name));
            try {
                startActivityForResult(i, RQ_SAVE);
            } catch (Exception e) {
                pendData = null;
                toast("No file picker available on this device");
            }
        }

        @JavascriptInterface public void pickFolder() {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
            try {
                startActivityForResult(i, RQ_FOLDER);
            } catch (Exception e) {
                pendData = null;
                toast("Folder picking is not available on this device");
            }
        }

        @JavascriptInterface public void share(String name, String mime, String dataUrl) {
            try {
                final String safe = sanitize(name == null || name.isEmpty() ? "share.bin" : name);
                byte[] bytes = decodeData(dataUrl);
                File dir = new File(getCacheDir(), "share");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("could not prepare share cache");
                File f = new File(dir, safe);
                FileOutputStream fo = new FileOutputStream(f);
                fo.write(bytes);
                fo.close();
                final Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + Uri.encode(safe));
                final String m = (mime == null || mime.isEmpty()) ? guessMime(safe) : mime;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType(m);
                        i.putExtra(Intent.EXTRA_STREAM, uri);
                        i.putExtra(Intent.EXTRA_TITLE, safe);
                        i.setClipData(ClipData.newUri(getContentResolver(), safe, uri));
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(i, "Share " + safe));
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "share failed", e);
                toast("Share failed: " + e.getMessage());
            }
        }
    }

    /* ---------------- misc ---------------- */

    private void toast(final String m) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                Toast.makeText(MainActivity.this, m, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // System light/dark switched while running: the WebView's preferred color
        // scheme updates with the configuration; re-apply the page palette so it
        // follows immediately even if the media-query change event is missed.
        if (web != null) {
            web.evaluateJavascript("typeof applyColors==='function'&&applyColors()", null);
            pushInsets();
        }
    }

    // How much of the page the system bars cover, so it can pad itself.
    private int insetTop() {
        View d = getWindow().getDecorView();
        if (d.getRootWindowInsets() == null) return 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.graphics.Insets i = d.getRootWindowInsets()
                    .getInsets(android.view.WindowInsets.Type.statusBars());
            return i == null ? 0 : i.top;
        }
        return d.getRootWindowInsets().getSystemWindowInsetTop();
    }

    private int insetBottom() {
        View d = getWindow().getDecorView();
        if (d.getRootWindowInsets() == null) return 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.graphics.Insets i = d.getRootWindowInsets()
                    .getInsets(android.view.WindowInsets.Type.navigationBars());
            return i == null ? 0 : i.bottom;
        }
        return d.getRootWindowInsets().getSystemWindowInsetBottom();
    }

    private void pushInsets() {
        if (web == null) return;
        final int top = insetTop();
        final int bottom = insetBottom();
        web.post(new Runnable() {
            @Override public void run() {
                web.evaluateJavascript(
                        "document.documentElement.style.setProperty('--sbt','" + top + "px');"
                      + "document.documentElement.style.setProperty('--sbb','" + bottom + "px')", null);
            }
        });
    }

    // Dark text on a light status bar, light text on a dark one.
    @JavascriptInterface public void setBarIcons(boolean dark) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                View d = getWindow().getDecorView();
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
                if (!dark) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                d.setSystemUiVisibility(flags);
            }
        });
    }

    @Override protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override public void onBackPressed() {
        // The app is a single page, so the WebView has no history: let the page
        // handle the back gesture first (close overlays, leave the tool, go home).
        if (web != null) {
            web.evaluateJavascript("(function(){try{return !!(window.appBack&&window.appBack())}catch(e){return false}})()", value -> {
                if (!"true".equals(value)) MainActivity.super.onBackPressed();
            });
            return;
        }
        super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
