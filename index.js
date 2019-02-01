#!/usr/bin/env node
const program = require("commander");
const { exec } = require("child_process");
const path = require("path");
const dotty = require("dotty");
const fs = require("fs");

program
  .version(require("./package.json").version)
  .usage("[options] <file ...>")
  .option("-m, --meta", "Print available metadata for a file")
  .option(
    "-f, --format <f>",
    "A formatting string to rename files. Use -m to see metadata names. Eg. '{date}.mp4'"
  )
  .parse(process.argv);

const files = [...program.args];

function getRecorderType(metadata) {
  const tags = dotty.get(metadata, "format.tags");
  const androidVersion = tags["com.android.version"];
  if (androidVersion) return `Android`;

  if (dotty.get(metadata, "streams.0.tags.handler_name").includes("GoPro"))
    return `GoPro`;

  return "Unknown";
}

function getCityName(metadata) {
  const findNearestCities = require("find-nearest-cities");
  const ll = dotty.get(metadata, "format.tags.location");
  const unknown = "Unknown location";
  if (!ll) return unknown;
  const match = ll.match(/([+-]\d\d\.\d\d\d\d)([+-]\d\d\d\.\d\d\d\d)\//);
  if (!match) return unknown;
  const longitude = Number(match[2]);
  const latitude = Number(match[1]);
  if (!latitude || !longitude) return unknown;
  const cities = findNearestCities(latitude, longitude, 100 * 1000);
  if (cities.length) return cities[0].name;
  return unknown;
}

function standardizeMetadata(metadata) {
  const Moment = require("moment");
  if (!metadata.streams) throw new Error("I don't know what this metadata is");
  const meta = {
    location: getCityName(metadata),
    recorder: getRecorderType(metadata)
  };
  metadata.streams.forEach(stream => {
    meta.duration = Number(stream.duration);
    meta.date = new Date(stream.tags.creation_time);
  });

  const m = Moment(meta.date);
  meta.year = m.format("YYYY");
  meta.month = m.format("MM");
  meta.day = m.format("DD");
  meta.hour = m.format("HH");
  meta.minute = m.format("mm");
  meta.second = m.format("ss");
  meta.date = m.format("YYYY-MM-DDTHH-mm-ss");
  return meta;
}

function getMetadata(file) {
  return new Promise((resolve, reject) => {
    const child = exec(
      [
        "ffprobe",
        `-i "${file}"`,
        "-print_format json",
        "-show_streams",
        "-show_format",
        "-hide_banner",
        "-v quiet"
      ].join(" "),
      (error, stdout, stderr) => {
        if (error) return reject(error);

        resolve(standardizeMetadata(JSON.parse(stdout)));
      }
    );
  });
}

function getFilename(metadata, format) {
  return require("string-format-obj")(format, metadata);
}

if (program.meta) {
  const Table = require("cli-table");
  const table = new Table({
    head: ["Key", "Value"],
    colWidths: [20, 50]
  });
  return getMetadata(files[0])
    .then(metadata => {
      Object.entries(metadata).forEach(([key, value]) =>
        table.push([key, value])
      );
      console.log(table.toString());
    })
    .catch(console.error);
}

if (program.format) {
  const async = require("async");
  const os = require("os");
  const cpuCount = os.cpus().length;
  console.log(`${cpuCount} CPUs`);
  async.eachLimit(files, os.cpus().length, (file, callback) => {
    const fileResolved = path.resolve(process.cwd(), file);
    getMetadata(fileResolved)
      .then(metadata => {
        const dir = path.dirname(fileResolved);
        const extension = path.extname(fileResolved).toLowerCase();
        const newFilename = getFilename(metadata, program.format) + extension;
        const destFileResolved = path.join(dir, newFilename);
        console.log(newFilename);
        fs.rename(fileResolved, destFileResolved, callback);
      })
      .catch(callback);
  });
}
