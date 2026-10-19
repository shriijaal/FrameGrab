package com.framegrab.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Locale;

/**
 * Serves files written to cache/share/ to other apps through content:// URIs,
 * so the system share sheet can attach them without any support library.
 */
public class ShareProvider extends ContentProvider {
    public static final String AUTHORITY = "com.framegrab.app.share";

    @Override public boolean onCreate() {
        return true;
    }

    @Override public String getType(Uri uri) {
        String n = uri.getLastPathSegment();
        String ext = n != null && n.lastIndexOf('.') >= 0
                ? n.substring(n.lastIndexOf('.') + 1).toLowerCase(Locale.US) : "";
        String m = ext.isEmpty() ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m == null ? "application/octet-stream" : m;
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null) throw new FileNotFoundException(uri.toString());
        File f = new File(new File(getContext().getCacheDir(), "share"), name);
        if (!f.exists()) throw new FileNotFoundException(uri.toString());
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri uri, String[] p, String s, String[] a, String sort) {
        return null;
    }

    @Override public int delete(Uri uri, String s, String[] a) {
        return 0;
    }

    @Override public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override public int update(Uri uri, ContentValues values, String s, String[] a) {
        return 0;
    }
}
