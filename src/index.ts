import {Plugin, LoadUtils, InstallUtils} from '@drovp/types';
import {promisify} from 'util';
import CP from 'child_process';
import {promises as FSP} from 'fs';
import Path from 'path';

const exec = promisify(CP.exec);

let lastAllInOneInstallTime = 0;

export default (plugin: Plugin) => {
	plugin.registerDependency('ffmpeg', {
		load: (utils) => load('ffmpeg', utils),
		install: (utils) => install('ffmpeg', utils),
	});

	plugin.registerDependency('ffprobe', {
		load: (utils) => load('ffprobe', utils),
		install: (utils) => install('ffprobe', utils),
	});

	plugin.registerDependency('ffplay', {
		load: (utils) => load('ffplay', utils),
		install: (utils) => install('ffplay', utils),
		instructions: 'ffplay.md',
	});
};

async function load(name: string, {dataPath}: LoadUtils) {
	const path = Path.join(dataPath, process.platform === 'win32' ? `${name}.exe` : name);

	async function checkPath(path: string) {
		let stdout = (await exec(`"${path}" -version`)).stdout;
		if (new RegExp(`^${name} version`, 'gi').exec(stdout) != null) return path;
		else throw new Error(`Unexpected stdout when loading ${name}:\n${stdout}`);
	}

	try {
		// Try loading our installed binary first
		const stat = await FSP.stat(path);
		if (!stat?.isFile()) return false;
		return await checkPath(path);
	} catch (error) {
		// Fallback to globally installed binary
		let {stdout} = await exec(`${process.platform === 'win32' ? 'where' : 'which'} ${name}`);
		let paths = `${stdout}`.trim().split(/\r?\n/);
		let path = paths[0];
		if (path) return await checkPath(`${path}`.trim());
		throw error;
	}
}

async function install(name: string, utils: InstallUtils) {
	switch (process.platform) {
		case 'win32':
			return installWindows(utils);
		case 'linux':
			return installLinux(utils);
		case 'darwin':
			return installDarwin(name, utils);
	}
}

async function installWindows(utils: InstallUtils) {
	await recentlyThrottle(utils, () =>
		installFromOnlineArchive(
			{
				url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z',
				filesToExtract: {
					'{rootFile}/bin/ffmpeg.exe': 'ffmpeg.exe',
					'{rootFile}/bin/ffprobe.exe': 'ffprobe.exe',
					'{rootFile}/bin/ffplay.exe': 'ffplay.exe',
				},
				onBeforeCopy: async () => {
					utils.stage('cleaning destination');
					await utils.cleanup(utils.dataPath);
				},
			},
			utils
		)
	);
}

async function installLinux(utils: InstallUtils) {
	await recentlyThrottle(utils, () =>
		installFromOnlineArchive(
			{
				url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
				filesToExtract: {
					'{rootFile}/ffmpeg': 'ffmpeg',
					'{rootFile}/ffprobe': 'ffprobe',
					// no ffplay in this archive
				},
				onBeforeCopy: async () => {
					utils.stage('cleaning destination');
					await utils.cleanup(utils.dataPath);
				},
			},
			utils
		)
	);
}

async function installDarwin(name: string, utils: InstallUtils) {
	await installFromOnlineArchive(
		{
			url: `https://evermeet.cx/ffmpeg/getrelease/${name}/7z`,
			filesToExtract: {[name]: name},
		},
		utils
	);
}

async function installFromOnlineArchive(
	{
		url,
		filesToExtract,
		onBeforeCopy,
	}: {url: string; filesToExtract: Record<string, string>; onBeforeCopy?: () => void},
	{dataPath, tmpPath, download, extract, cleanup, progress, stage, log}: InstallUtils
) {
	stage('downloading');
	log(`url: ${url}`);
	const filename = await download(url, tmpPath, {onProgress: progress});
	const archivePath = Path.join(tmpPath, filename);
	const archiveName = filename.replace(/\.[a-z\.]+$/, '');

	stage('extracting');
	log(`archive: ${archivePath}`);
	const extractedFiles = await extract(archivePath);
	const firstFile = extractedFiles[0];

	if (!firstFile || extractedFiles.length !== 1) {
		if (extractedFiles.length === 0) throw new Error(`Extracted archive files list is empty.`);
		else throw new Error(`Unexpected archive structure:\b${extractedFiles.join('\n')}`);
	}

	if (onBeforeCopy) await onBeforeCopy();

	const archiveRootPath = Path.join(tmpPath, firstFile);

	try {
		log(`copying "${Object.values(filesToExtract).join('", "')}"`);
		log(`-> from: ${archiveRootPath}`);
		log(`-> to: ${dataPath}`);

		for (const [sourceFile, destFile] of Object.entries(filesToExtract)) {
			const deTokenizedSourceFile = sourceFile
				.replace('{rootFile}', firstFile)
				.replace('{archiveName}', archiveName);
			const binFilePath = Path.join(tmpPath, deTokenizedSourceFile);
			const destFilePath = Path.join(dataPath, destFile);
			await FSP.rename(binFilePath, destFilePath);
		}
	} catch (error) {
		if (error instanceof Error && (error as any).code === 'ENOENT') {
			throw new Error(`Unexpected archive structure: ${error.message}`);
		} else {
			throw error;
		}
	}
}

/*
 * If we installed less than 5 minutes ago and everything exists, assume
 * Drovp is calling installation of multiple dependencies one after the
 * other, and because windows and linux binary distributions are only all in
 * one packages, we'll just skip it.
 *
 * Edit: This shouldn't be necessary anymore, as Drovp plugin installer checks
 * each dependency before install, but I'll keep it here just in case.
 */
async function recentlyThrottle(utils: LoadUtils, fn: () => any) {
	let exists: string | boolean = false;
	try {
		exists = await load('ffmpeg', utils);
	} catch {}

	const time = Date.now();
	if (exists && time < lastAllInOneInstallTime + 60_000 * 5) return;

	await fn();

	lastAllInOneInstallTime = time;
}
