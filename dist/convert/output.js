export function getFileExtension(filePath) {
    const ext = sigma.path.extname(filePath);
    return ext ? ext.substring(1).toLowerCase() : '';
}
export function getFileNameWithoutExtension(filePath) {
    const base = sigma.path.basename(filePath);
    const ext = sigma.path.extname(base);
    return ext ? base.substring(0, base.length - ext.length) : base;
}
export function getDirectoryFromPath(filePath) {
    if (!filePath)
        return null;
    return sigma.path.dirname(filePath);
}
export function detectSeparator(filePath) {
    const lastBackslash = filePath.lastIndexOf('\\');
    const lastForwardSlash = filePath.lastIndexOf('/');
    if (lastBackslash === -1 && lastForwardSlash === -1)
        return sigma.platform.pathSeparator;
    return lastForwardSlash > lastBackslash ? '/' : '\\';
}
export function getFileNameFromPath(filePath) {
    return sigma.path.basename(filePath);
}
export function normalizeOutputNameKey(fileName) {
    return sigma.platform.isWindows ? fileName.toLowerCase() : fileName;
}
export function normalizeFilePath(filePath) {
    if (sigma.platform.isWindows) {
        return filePath.replace(/\//g, '\\');
    }
    return filePath.replace(/\\/g, '/');
}
function escapePowerShellSingleQuotedString(value) {
    return value.replace(/'/g, "''");
}
export function buildExistingNamesSet(entries) {
    const nameSet = new Set();
    for (const entry of entries) {
        const fileName = entry.name || getFileNameFromPath(entry.path || '');
        nameSet.add(normalizeOutputNameKey(fileName));
    }
    return nameSet;
}
export async function buildExistingNamesSetForDirectory(directoryPath, fallbackEntries) {
    try {
        const directoryEntries = await sigma.fs.readDir(directoryPath);
        return buildExistingNamesSet(directoryEntries);
    }
    catch (readDirectoryError) {
        console.warn('[Media Converter] Could not read directory entries:', readDirectoryError);
        return buildExistingNamesSet(fallbackEntries || []);
    }
}
export function resolveOutputFileName(baseName, extension, existingNamesSet) {
    const candidate = `${baseName}.${extension}`;
    const candidateKey = normalizeOutputNameKey(candidate);
    if (!existingNamesSet.has(candidateKey)) {
        existingNamesSet.add(candidateKey);
        return candidate;
    }
    for (let counter = 1; counter <= 999; counter++) {
        const numbered = `${baseName} (${counter}).${extension}`;
        const numberedKey = normalizeOutputNameKey(numbered);
        if (!existingNamesSet.has(numberedKey)) {
            existingNamesSet.add(numberedKey);
            return numbered;
        }
    }
    const fallback = `${baseName} (${Date.now()}).${extension}`;
    existingNamesSet.add(normalizeOutputNameKey(fallback));
    return fallback;
}
export async function ensureDirectoryExists(directoryPath) {
    const normalizedDirectoryPath = normalizeFilePath(directoryPath);
    if (sigma.platform.isWindows) {
        const escapedPath = escapePowerShellSingleQuotedString(normalizedDirectoryPath);
        const result = await sigma.shell.run('powershell', [
            '-NoProfile',
            '-Command',
            `New-Item -ItemType Directory -Force -Path '${escapedPath}' | Out-Null`,
        ]);
        if (result.code !== 0) {
            throw new Error(result.stderr.trim() || result.stdout.trim() || `Failed to create directory: ${directoryPath}`);
        }
        return;
    }
    const result = await sigma.shell.run('mkdir', ['-p', normalizedDirectoryPath]);
    if (result.code !== 0) {
        throw new Error(result.stderr.trim() || `Failed to create directory: ${directoryPath}`);
    }
}
export function resolveOutputDirectory(sourceDirectory, separator, useSubfolder, subfolderName) {
    if (!useSubfolder) {
        return sourceDirectory;
    }
    return `${sourceDirectory}${separator}${subfolderName}`;
}
export async function getFileSizeBytesByPath(filePath) {
    const normalizedPath = normalizeFilePath(filePath);
    const directory = getDirectoryFromPath(normalizedPath);
    const baseName = getFileNameFromPath(normalizedPath);
    if (!directory)
        return null;
    try {
        const fileExists = await sigma.fs.exists(normalizedPath);
        if (!fileExists) {
            return null;
        }
        const entries = await sigma.fs.readDir(directory);
        const expectedNameKey = normalizeOutputNameKey(baseName);
        const match = entries.find((entry) => {
            if (normalizeOutputNameKey(entry.name) === expectedNameKey) {
                return true;
            }
            return normalizeFilePath(entry.path) === normalizedPath;
        });
        if (match && typeof match.size === 'number') {
            return match.size;
        }
    }
    catch (sizeError) {
        console.warn('[Media Converter] Could not read file size:', sizeError);
    }
    return null;
}
export function getEntryInputSizeBytes(entry) {
    if (typeof entry.size === 'number' && entry.size >= 0) {
        return entry.size;
    }
    return null;
}
export async function prepareOutputLocation(filePath, baseName, extension, existingNamesSets, outputSubfolderSettings, preparedOutputDirectories, fallbackEntries) {
    const sourceDirectory = getDirectoryFromPath(filePath);
    if (!sourceDirectory) {
        return null;
    }
    const separator = detectSeparator(filePath);
    const useSubfolder = outputSubfolderSettings.useSubfolder;
    let outputDirectory = resolveOutputDirectory(sourceDirectory, separator, useSubfolder, outputSubfolderSettings.subfolderName);
    if (useSubfolder && !preparedOutputDirectories.has(outputDirectory)) {
        preparedOutputDirectories.add(outputDirectory);
        existingNamesSets[outputDirectory] = await buildExistingNamesSetForDirectory(outputDirectory, []);
        await ensureDirectoryExists(outputDirectory);
    }
    const existingNames = existingNamesSets[outputDirectory]
        || existingNamesSets[sourceDirectory]
        || new Set();
    const outputFileName = resolveOutputFileName(baseName, extension, existingNames);
    const outputPath = `${outputDirectory}${separator}${outputFileName}`;
    return { outputDirectory, outputPath, separator };
}
export async function preloadExistingNamesSets(files, entries) {
    const existingNamesSets = {};
    for (const file of files) {
        const directoryPath = getDirectoryFromPath(file.path);
        if (directoryPath && !existingNamesSets[directoryPath]) {
            existingNamesSets[directoryPath] = await buildExistingNamesSetForDirectory(directoryPath, entries.filter((entry) => getDirectoryFromPath(entry.path) === directoryPath));
        }
    }
    return existingNamesSets;
}
