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
 * Gives the system camera app a place to write a photo and gives the WebView a
 * place to read it back, through content:// URIs. This is the same job as
 * androidx FileProvider, done without the support library.
 */
public class PhotoProvider extends ContentProvider {
    public static final String AUTHORITY = "com.framegrab.app.photo";

    @Override public boolean onCreate() {
        return true;
    }

    @Override public String getType(Uri uri) {
        String n = uri.getLastPathSegment();
        String ext = n != null && n.lastIndexOf('.') >= 0
                ? n.substring(n.lastIndexOf('.') + 1).toLowerCase(Locale.US) : "";
        String m = ext.isEmpty() ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return m == null ? "image/jpeg" : m;
    }

    private File resolve(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || name.isEmpty()
                || name.indexOf('/') >= 0 || name.indexOf('\\') >= 0
                || name.equals(".") || name.equals("..")) {
            throw new FileNotFoundException(uri.toString());
        }
        return new File(new File(getContext().getCacheDir(), "photo"), name);
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = resolve(uri);
        int flags;
        if ("r".equals(mode)) {
            if (!f.exists()) throw new FileNotFoundException(uri.toString());
            flags = ParcelFileDescriptor.MODE_READ_ONLY;
        } else if ("w".equals(mode) || "wt".equals(mode)) {
            File dir = f.getParentFile();
            if (dir != null && !dir.exists() && !dir.mkdirs()) {
                throw new FileNotFoundException("could not create " + dir);
            }
            flags = ParcelFileDescriptor.MODE_CREATE
                    | ParcelFileDescriptor.MODE_READ_WRITE
                    | ParcelFileDescriptor.MODE_TRUNCATE;
        } else {
            if (!f.exists()) throw new FileNotFoundException(uri.toString());
            flags = ParcelFileDescriptor.MODE_READ_WRITE;
        }
        return ParcelFileDescriptor.open(f, flags);
    }

    @Override public Cursor query(Uri uri, String[] p, String s, String[] a, String sort) {
        return null;
    }

    @Override public int delete(Uri uri, String s, String[] a) {
        try {
            return resolve(uri).delete() ? 1 : 0;
        } catch (FileNotFoundException e) {
            return 0;
        }
    }

    @Override public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override public int update(Uri uri, ContentValues values, String s, String[] a) {
        return 0;
    }
}
