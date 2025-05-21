import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useEffect, useRef, useState } from "react";
import { AudioVisualizer } from "react-audio-visualize";
import "./App.css";
const frameMsgRegex =
  /frame=(\d+)fps=([\d.]+)q=([-\d.]+)size=(\d+kB)time=([\d:.]+)bitrate=([\d.]+kbits\/s)speed=([\d.]+x)/;
const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";

export default function App() {
  const [inited, setInited] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const messageRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const [volumeBoost, setVolumeBoost] = useState(150); // default 150%
  const [processing, setProcessing] = useState(false);
  const [inputUrl, setInputUrl] = useState(null);
  const [outputUrl, setOutputUrl] = useState(null);
  const inputRef = useRef();
  const [progress, setProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const onMessage = ({ message }) => {
    const match = message.replaceAll(" ", "").match(frameMsgRegex);
    if (match) {
      const [_, frame, fps, q, size, time, bitrate, speed] = match;
      messageRef.current.innerHTML = time;
      setProgress((+size.replaceAll("kB", "") * 1000) / videoFile.size);
    } else if (message.startsWith("Abort")) {
      messageRef.current.innerHTML = "Done!";
      setProgress(0);
    } else if (message.length < 80) {
      messageRef.current.innerHTML = message;
    }
  };

  const init = async () => {
    const ffmpeg = ffmpegRef.current;
    ffmpeg
      .load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      })
      .then(() => {
        setInited(true);
      });
  };

  const handleConvert = async () => {
    if (!videoFile || !inited) return;
    setProcessing(true);
    const volumeRatio = volumeBoost / 100;
    const inputName = videoFile.name;
    const outputName = `(Boosted vol ${volumeRatio}) ${inputName}`;

    const ffmpeg = ffmpegRef.current;
    try {
      const videoContent = await fetchFile(videoFile);
      await ffmpeg.writeFile(inputName, videoContent);
      ffmpeg.on("log", onMessage);

      await ffmpeg.exec([
        "-i",
        inputName,
        "-vcodec",
        "copy",
        "-af",
        `volume=${volumeRatio}`,
        outputName,
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      ffmpeg.off("log", onMessage);
    }

    ffmpeg
      .readFile(outputName)
      .then((d) => {
        const newBlob = new Blob([d.buffer], { type: "video/mp4" });
        setOutputUrl(newBlob);
      })
      .finally(() => {
        setProcessing(false);
      });
  };

  const downloadUrl = outputUrl ? URL.createObjectURL(outputUrl) : undefined;

  const handleFileChange = (e) => {
    setVideoFile(e.target.files?.[0] || null);
    setOutputUrl(null);
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (showPreview) {
      if (videoFile) {
        setInputUrl(videoFile);
      } else {
        setInputUrl(null);
      }
    }
  }, [videoFile, showPreview]);

  return (
    <div className="min-h-screen min-w-screen bg-gray-900 text-white flex flex-col items-center justify-center px-4">
      <img src={"./logo.svg"} className="max-h-16" />
      <h1 className="text-3xl font-bold my-4">Volume booster</h1>
      <div className="flex gap-2 items-center my-4 ">
        <button
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded cursor-pointer"
          onClick={() => inputRef.current.click()}
        >
          Chọn video {videoFile ? `khác` : ""}
        </button>
        <button
          onClick={() => setShowPreview((prev) => !prev)}
          className="bg-amber-600 px-4 py-2 rounded cursor-pointer hover:bg-amber-700"
        >
          {showPreview ? "Tắt" : "Bật"} xem trước
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <label className="mb-2">
        Âm thanh (%):
        <input
          type="number"
          min="10"
          max="500"
          value={volumeBoost}
          onChange={(e) => setVolumeBoost(Number(e.target.value))}
          className="ml-2 px-2 py-1 rounded bg-gray-800 border border-gray-600 "
        />
      </label>
      <button
        onClick={handleConvert}
        disabled={!videoFile || processing || !inited}
        className="px-4 mt-2 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 cursor-pointer"
      >
        {processing ? "Đang chuyển đổi..." : "Tạo video"}
      </button>

      {videoFile && <p className="my-2">{videoFile.name}</p>}
      {progress > 0 && (
        <div className="h-2 rounded w-64 bg-gray-600 my-2">
          <div
            className="h-2 rounded bg-green-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      <p ref={messageRef} />
      {showPreview && (
        <div className="mt-6 w-[410px] h-[200px] bg-gray-700 relative rounded-2xl">
          {inputUrl && (
            <AudioVisualizer
              style={{ position: "absolute", zIndex: 1, top: 4, left: 4 }}
              blob={inputUrl}
              width={400}
              height={200}
              barWidth={1}
              gap={0}
              barColor={"#7700ff"}
            />
          )}
          {outputUrl && (
            <AudioVisualizer
              style={{ position: "absolute", top: 4, left: 4 }}
              blob={outputUrl}
              width={400}
              height={200}
              barWidth={1}
              gap={0}
              barColor={"#00ff40"}
            />
          )}
        </div>
      )}

      {downloadUrl && (
        <a
          href={downloadUrl}
          download={`(Boosted vol ${volumeBoost / 100}) ${videoFile?.name}`}
          className="text-blue-400 hover:underline text-center"
        >
          Tải xuống video
        </a>
      )}
    </div>
  );
}
