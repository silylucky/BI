"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/unicode.js
var require_unicode = __commonJS({
  "node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/unicode.js"(exports2, module2) {
    module2.exports.Space_Separator = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
    module2.exports.ID_Start = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
    module2.exports.ID_Continue = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;
  }
});

// node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/util.js
var require_util = __commonJS({
  "node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/util.js"(exports2, module2) {
    var unicode = require_unicode();
    module2.exports = {
      isSpaceSeparator(c) {
        return typeof c === "string" && unicode.Space_Separator.test(c);
      },
      isIdStartChar(c) {
        return typeof c === "string" && (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "$" || c === "_" || unicode.ID_Start.test(c));
      },
      isIdContinueChar(c) {
        return typeof c === "string" && (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c >= "0" && c <= "9" || c === "$" || c === "_" || c === "\u200C" || c === "\u200D" || unicode.ID_Continue.test(c));
      },
      isDigit(c) {
        return typeof c === "string" && /[0-9]/.test(c);
      },
      isHexDigit(c) {
        return typeof c === "string" && /[0-9A-Fa-f]/.test(c);
      }
    };
  }
});

// node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/parse.js
var require_parse = __commonJS({
  "node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/parse.js"(exports2, module2) {
    var util = require_util();
    var source;
    var parseState;
    var stack;
    var pos;
    var line;
    var column;
    var token;
    var key;
    var root;
    module2.exports = function parse(text, reviver) {
      source = String(text);
      parseState = "start";
      stack = [];
      pos = 0;
      line = 1;
      column = 0;
      token = void 0;
      key = void 0;
      root = void 0;
      do {
        token = lex();
        parseStates[parseState]();
      } while (token.type !== "eof");
      if (typeof reviver === "function") {
        return internalize({ "": root }, "", reviver);
      }
      return root;
    };
    function internalize(holder, name, reviver) {
      const value = holder[name];
      if (value != null && typeof value === "object") {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const key2 = String(i);
            const replacement = internalize(value, key2, reviver);
            if (replacement === void 0) {
              delete value[key2];
            } else {
              Object.defineProperty(value, key2, {
                value: replacement,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          }
        } else {
          for (const key2 in value) {
            const replacement = internalize(value, key2, reviver);
            if (replacement === void 0) {
              delete value[key2];
            } else {
              Object.defineProperty(value, key2, {
                value: replacement,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          }
        }
      }
      return reviver.call(holder, name, value);
    }
    var lexState;
    var buffer;
    var doubleQuote;
    var sign;
    var c;
    function lex() {
      lexState = "default";
      buffer = "";
      doubleQuote = false;
      sign = 1;
      for (; ; ) {
        c = peek();
        const token2 = lexStates[lexState]();
        if (token2) {
          return token2;
        }
      }
    }
    function peek() {
      if (source[pos]) {
        return String.fromCodePoint(source.codePointAt(pos));
      }
    }
    function read() {
      const c2 = peek();
      if (c2 === "\n") {
        line++;
        column = 0;
      } else if (c2) {
        column += c2.length;
      } else {
        column++;
      }
      if (c2) {
        pos += c2.length;
      }
      return c2;
    }
    var lexStates = {
      default() {
        switch (c) {
          case "	":
          case "\v":
          case "\f":
          case " ":
          case "\xA0":
          case "\uFEFF":
          case "\n":
          case "\r":
          case "\u2028":
          case "\u2029":
            read();
            return;
          case "/":
            read();
            lexState = "comment";
            return;
          case void 0:
            read();
            return newToken("eof");
        }
        if (util.isSpaceSeparator(c)) {
          read();
          return;
        }
        return lexStates[parseState]();
      },
      comment() {
        switch (c) {
          case "*":
            read();
            lexState = "multiLineComment";
            return;
          case "/":
            read();
            lexState = "singleLineComment";
            return;
        }
        throw invalidChar(read());
      },
      multiLineComment() {
        switch (c) {
          case "*":
            read();
            lexState = "multiLineCommentAsterisk";
            return;
          case void 0:
            throw invalidChar(read());
        }
        read();
      },
      multiLineCommentAsterisk() {
        switch (c) {
          case "*":
            read();
            return;
          case "/":
            read();
            lexState = "default";
            return;
          case void 0:
            throw invalidChar(read());
        }
        read();
        lexState = "multiLineComment";
      },
      singleLineComment() {
        switch (c) {
          case "\n":
          case "\r":
          case "\u2028":
          case "\u2029":
            read();
            lexState = "default";
            return;
          case void 0:
            read();
            return newToken("eof");
        }
        read();
      },
      value() {
        switch (c) {
          case "{":
          case "[":
            return newToken("punctuator", read());
          case "n":
            read();
            literal("ull");
            return newToken("null", null);
          case "t":
            read();
            literal("rue");
            return newToken("boolean", true);
          case "f":
            read();
            literal("alse");
            return newToken("boolean", false);
          case "-":
          case "+":
            if (read() === "-") {
              sign = -1;
            }
            lexState = "sign";
            return;
          case ".":
            buffer = read();
            lexState = "decimalPointLeading";
            return;
          case "0":
            buffer = read();
            lexState = "zero";
            return;
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
            buffer = read();
            lexState = "decimalInteger";
            return;
          case "I":
            read();
            literal("nfinity");
            return newToken("numeric", Infinity);
          case "N":
            read();
            literal("aN");
            return newToken("numeric", NaN);
          case '"':
          case "'":
            doubleQuote = read() === '"';
            buffer = "";
            lexState = "string";
            return;
        }
        throw invalidChar(read());
      },
      identifierNameStartEscape() {
        if (c !== "u") {
          throw invalidChar(read());
        }
        read();
        const u = unicodeEscape();
        switch (u) {
          case "$":
          case "_":
            break;
          default:
            if (!util.isIdStartChar(u)) {
              throw invalidIdentifier();
            }
            break;
        }
        buffer += u;
        lexState = "identifierName";
      },
      identifierName() {
        switch (c) {
          case "$":
          case "_":
          case "\u200C":
          case "\u200D":
            buffer += read();
            return;
          case "\\":
            read();
            lexState = "identifierNameEscape";
            return;
        }
        if (util.isIdContinueChar(c)) {
          buffer += read();
          return;
        }
        return newToken("identifier", buffer);
      },
      identifierNameEscape() {
        if (c !== "u") {
          throw invalidChar(read());
        }
        read();
        const u = unicodeEscape();
        switch (u) {
          case "$":
          case "_":
          case "\u200C":
          case "\u200D":
            break;
          default:
            if (!util.isIdContinueChar(u)) {
              throw invalidIdentifier();
            }
            break;
        }
        buffer += u;
        lexState = "identifierName";
      },
      sign() {
        switch (c) {
          case ".":
            buffer = read();
            lexState = "decimalPointLeading";
            return;
          case "0":
            buffer = read();
            lexState = "zero";
            return;
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9":
            buffer = read();
            lexState = "decimalInteger";
            return;
          case "I":
            read();
            literal("nfinity");
            return newToken("numeric", sign * Infinity);
          case "N":
            read();
            literal("aN");
            return newToken("numeric", NaN);
        }
        throw invalidChar(read());
      },
      zero() {
        switch (c) {
          case ".":
            buffer += read();
            lexState = "decimalPoint";
            return;
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
          case "x":
          case "X":
            buffer += read();
            lexState = "hexadecimal";
            return;
        }
        return newToken("numeric", sign * 0);
      },
      decimalInteger() {
        switch (c) {
          case ".":
            buffer += read();
            lexState = "decimalPoint";
            return;
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      decimalPointLeading() {
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalFraction";
          return;
        }
        throw invalidChar(read());
      },
      decimalPoint() {
        switch (c) {
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalFraction";
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      decimalFraction() {
        switch (c) {
          case "e":
          case "E":
            buffer += read();
            lexState = "decimalExponent";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      decimalExponent() {
        switch (c) {
          case "+":
          case "-":
            buffer += read();
            lexState = "decimalExponentSign";
            return;
        }
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalExponentInteger";
          return;
        }
        throw invalidChar(read());
      },
      decimalExponentSign() {
        if (util.isDigit(c)) {
          buffer += read();
          lexState = "decimalExponentInteger";
          return;
        }
        throw invalidChar(read());
      },
      decimalExponentInteger() {
        if (util.isDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      hexadecimal() {
        if (util.isHexDigit(c)) {
          buffer += read();
          lexState = "hexadecimalInteger";
          return;
        }
        throw invalidChar(read());
      },
      hexadecimalInteger() {
        if (util.isHexDigit(c)) {
          buffer += read();
          return;
        }
        return newToken("numeric", sign * Number(buffer));
      },
      string() {
        switch (c) {
          case "\\":
            read();
            buffer += escape();
            return;
          case '"':
            if (doubleQuote) {
              read();
              return newToken("string", buffer);
            }
            buffer += read();
            return;
          case "'":
            if (!doubleQuote) {
              read();
              return newToken("string", buffer);
            }
            buffer += read();
            return;
          case "\n":
          case "\r":
            throw invalidChar(read());
          case "\u2028":
          case "\u2029":
            separatorChar(c);
            break;
          case void 0:
            throw invalidChar(read());
        }
        buffer += read();
      },
      start() {
        switch (c) {
          case "{":
          case "[":
            return newToken("punctuator", read());
        }
        lexState = "value";
      },
      beforePropertyName() {
        switch (c) {
          case "$":
          case "_":
            buffer = read();
            lexState = "identifierName";
            return;
          case "\\":
            read();
            lexState = "identifierNameStartEscape";
            return;
          case "}":
            return newToken("punctuator", read());
          case '"':
          case "'":
            doubleQuote = read() === '"';
            lexState = "string";
            return;
        }
        if (util.isIdStartChar(c)) {
          buffer += read();
          lexState = "identifierName";
          return;
        }
        throw invalidChar(read());
      },
      afterPropertyName() {
        if (c === ":") {
          return newToken("punctuator", read());
        }
        throw invalidChar(read());
      },
      beforePropertyValue() {
        lexState = "value";
      },
      afterPropertyValue() {
        switch (c) {
          case ",":
          case "}":
            return newToken("punctuator", read());
        }
        throw invalidChar(read());
      },
      beforeArrayValue() {
        if (c === "]") {
          return newToken("punctuator", read());
        }
        lexState = "value";
      },
      afterArrayValue() {
        switch (c) {
          case ",":
          case "]":
            return newToken("punctuator", read());
        }
        throw invalidChar(read());
      },
      end() {
        throw invalidChar(read());
      }
    };
    function newToken(type, value) {
      return {
        type,
        value,
        line,
        column
      };
    }
    function literal(s) {
      for (const c2 of s) {
        const p = peek();
        if (p !== c2) {
          throw invalidChar(read());
        }
        read();
      }
    }
    function escape() {
      const c2 = peek();
      switch (c2) {
        case "b":
          read();
          return "\b";
        case "f":
          read();
          return "\f";
        case "n":
          read();
          return "\n";
        case "r":
          read();
          return "\r";
        case "t":
          read();
          return "	";
        case "v":
          read();
          return "\v";
        case "0":
          read();
          if (util.isDigit(peek())) {
            throw invalidChar(read());
          }
          return "\0";
        case "x":
          read();
          return hexEscape();
        case "u":
          read();
          return unicodeEscape();
        case "\n":
        case "\u2028":
        case "\u2029":
          read();
          return "";
        case "\r":
          read();
          if (peek() === "\n") {
            read();
          }
          return "";
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          throw invalidChar(read());
        case void 0:
          throw invalidChar(read());
      }
      return read();
    }
    function hexEscape() {
      let buffer2 = "";
      let c2 = peek();
      if (!util.isHexDigit(c2)) {
        throw invalidChar(read());
      }
      buffer2 += read();
      c2 = peek();
      if (!util.isHexDigit(c2)) {
        throw invalidChar(read());
      }
      buffer2 += read();
      return String.fromCodePoint(parseInt(buffer2, 16));
    }
    function unicodeEscape() {
      let buffer2 = "";
      let count = 4;
      while (count-- > 0) {
        const c2 = peek();
        if (!util.isHexDigit(c2)) {
          throw invalidChar(read());
        }
        buffer2 += read();
      }
      return String.fromCodePoint(parseInt(buffer2, 16));
    }
    var parseStates = {
      start() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        push();
      },
      beforePropertyName() {
        switch (token.type) {
          case "identifier":
          case "string":
            key = token.value;
            parseState = "afterPropertyName";
            return;
          case "punctuator":
            pop();
            return;
          case "eof":
            throw invalidEOF();
        }
      },
      afterPropertyName() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        parseState = "beforePropertyValue";
      },
      beforePropertyValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        push();
      },
      beforeArrayValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        if (token.type === "punctuator" && token.value === "]") {
          pop();
          return;
        }
        push();
      },
      afterPropertyValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        switch (token.value) {
          case ",":
            parseState = "beforePropertyName";
            return;
          case "}":
            pop();
        }
      },
      afterArrayValue() {
        if (token.type === "eof") {
          throw invalidEOF();
        }
        switch (token.value) {
          case ",":
            parseState = "beforeArrayValue";
            return;
          case "]":
            pop();
        }
      },
      end() {
      }
    };
    function push() {
      let value;
      switch (token.type) {
        case "punctuator":
          switch (token.value) {
            case "{":
              value = {};
              break;
            case "[":
              value = [];
              break;
          }
          break;
        case "null":
        case "boolean":
        case "numeric":
        case "string":
          value = token.value;
          break;
      }
      if (root === void 0) {
        root = value;
      } else {
        const parent = stack[stack.length - 1];
        if (Array.isArray(parent)) {
          parent.push(value);
        } else {
          Object.defineProperty(parent, key, {
            value,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      if (value !== null && typeof value === "object") {
        stack.push(value);
        if (Array.isArray(value)) {
          parseState = "beforeArrayValue";
        } else {
          parseState = "beforePropertyName";
        }
      } else {
        const current = stack[stack.length - 1];
        if (current == null) {
          parseState = "end";
        } else if (Array.isArray(current)) {
          parseState = "afterArrayValue";
        } else {
          parseState = "afterPropertyValue";
        }
      }
    }
    function pop() {
      stack.pop();
      const current = stack[stack.length - 1];
      if (current == null) {
        parseState = "end";
      } else if (Array.isArray(current)) {
        parseState = "afterArrayValue";
      } else {
        parseState = "afterPropertyValue";
      }
    }
    function invalidChar(c2) {
      if (c2 === void 0) {
        return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
      }
      return syntaxError(`JSON5: invalid character '${formatChar(c2)}' at ${line}:${column}`);
    }
    function invalidEOF() {
      return syntaxError(`JSON5: invalid end of input at ${line}:${column}`);
    }
    function invalidIdentifier() {
      column -= 5;
      return syntaxError(`JSON5: invalid identifier character at ${line}:${column}`);
    }
    function separatorChar(c2) {
      console.warn(`JSON5: '${formatChar(c2)}' in strings is not valid ECMAScript; consider escaping`);
    }
    function formatChar(c2) {
      const replacements = {
        "'": "\\'",
        '"': '\\"',
        "\\": "\\\\",
        "\b": "\\b",
        "\f": "\\f",
        "\n": "\\n",
        "\r": "\\r",
        "	": "\\t",
        "\v": "\\v",
        "\0": "\\0",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029"
      };
      if (replacements[c2]) {
        return replacements[c2];
      }
      if (c2 < " ") {
        const hexString = c2.charCodeAt(0).toString(16);
        return "\\x" + ("00" + hexString).substring(hexString.length);
      }
      return c2;
    }
    function syntaxError(message) {
      const err = new SyntaxError(message);
      err.lineNumber = line;
      err.columnNumber = column;
      return err;
    }
  }
});

// node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/stringify.js
var require_stringify = __commonJS({
  "node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/stringify.js"(exports2, module2) {
    var util = require_util();
    module2.exports = function stringify(value, replacer, space) {
      const stack = [];
      let indent = "";
      let propertyList;
      let replacerFunc;
      let gap = "";
      let quote;
      if (replacer != null && typeof replacer === "object" && !Array.isArray(replacer)) {
        space = replacer.space;
        quote = replacer.quote;
        replacer = replacer.replacer;
      }
      if (typeof replacer === "function") {
        replacerFunc = replacer;
      } else if (Array.isArray(replacer)) {
        propertyList = [];
        for (const v of replacer) {
          let item;
          if (typeof v === "string") {
            item = v;
          } else if (typeof v === "number" || v instanceof String || v instanceof Number) {
            item = String(v);
          }
          if (item !== void 0 && propertyList.indexOf(item) < 0) {
            propertyList.push(item);
          }
        }
      }
      if (space instanceof Number) {
        space = Number(space);
      } else if (space instanceof String) {
        space = String(space);
      }
      if (typeof space === "number") {
        if (space > 0) {
          space = Math.min(10, Math.floor(space));
          gap = "          ".substr(0, space);
        }
      } else if (typeof space === "string") {
        gap = space.substr(0, 10);
      }
      return serializeProperty("", { "": value });
      function serializeProperty(key, holder) {
        let value2 = holder[key];
        if (value2 != null) {
          if (typeof value2.toJSON5 === "function") {
            value2 = value2.toJSON5(key);
          } else if (typeof value2.toJSON === "function") {
            value2 = value2.toJSON(key);
          }
        }
        if (replacerFunc) {
          value2 = replacerFunc.call(holder, key, value2);
        }
        if (value2 instanceof Number) {
          value2 = Number(value2);
        } else if (value2 instanceof String) {
          value2 = String(value2);
        } else if (value2 instanceof Boolean) {
          value2 = value2.valueOf();
        }
        switch (value2) {
          case null:
            return "null";
          case true:
            return "true";
          case false:
            return "false";
        }
        if (typeof value2 === "string") {
          return quoteString(value2, false);
        }
        if (typeof value2 === "number") {
          return String(value2);
        }
        if (typeof value2 === "object") {
          return Array.isArray(value2) ? serializeArray(value2) : serializeObject(value2);
        }
        return void 0;
      }
      function quoteString(value2) {
        const quotes = {
          "'": 0.1,
          '"': 0.2
        };
        const replacements = {
          "'": "\\'",
          '"': '\\"',
          "\\": "\\\\",
          "\b": "\\b",
          "\f": "\\f",
          "\n": "\\n",
          "\r": "\\r",
          "	": "\\t",
          "\v": "\\v",
          "\0": "\\0",
          "\u2028": "\\u2028",
          "\u2029": "\\u2029"
        };
        let product = "";
        for (let i = 0; i < value2.length; i++) {
          const c = value2[i];
          switch (c) {
            case "'":
            case '"':
              quotes[c]++;
              product += c;
              continue;
            case "\0":
              if (util.isDigit(value2[i + 1])) {
                product += "\\x00";
                continue;
              }
          }
          if (replacements[c]) {
            product += replacements[c];
            continue;
          }
          if (c < " ") {
            let hexString = c.charCodeAt(0).toString(16);
            product += "\\x" + ("00" + hexString).substring(hexString.length);
            continue;
          }
          product += c;
        }
        const quoteChar = quote || Object.keys(quotes).reduce((a, b) => quotes[a] < quotes[b] ? a : b);
        product = product.replace(new RegExp(quoteChar, "g"), replacements[quoteChar]);
        return quoteChar + product + quoteChar;
      }
      function serializeObject(value2) {
        if (stack.indexOf(value2) >= 0) {
          throw TypeError("Converting circular structure to JSON5");
        }
        stack.push(value2);
        let stepback = indent;
        indent = indent + gap;
        let keys = propertyList || Object.keys(value2);
        let partial = [];
        for (const key of keys) {
          const propertyString = serializeProperty(key, value2);
          if (propertyString !== void 0) {
            let member = serializeKey(key) + ":";
            if (gap !== "") {
              member += " ";
            }
            member += propertyString;
            partial.push(member);
          }
        }
        let final;
        if (partial.length === 0) {
          final = "{}";
        } else {
          let properties;
          if (gap === "") {
            properties = partial.join(",");
            final = "{" + properties + "}";
          } else {
            let separator = ",\n" + indent;
            properties = partial.join(separator);
            final = "{\n" + indent + properties + ",\n" + stepback + "}";
          }
        }
        stack.pop();
        indent = stepback;
        return final;
      }
      function serializeKey(key) {
        if (key.length === 0) {
          return quoteString(key, true);
        }
        const firstChar = String.fromCodePoint(key.codePointAt(0));
        if (!util.isIdStartChar(firstChar)) {
          return quoteString(key, true);
        }
        for (let i = firstChar.length; i < key.length; i++) {
          if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)))) {
            return quoteString(key, true);
          }
        }
        return key;
      }
      function serializeArray(value2) {
        if (stack.indexOf(value2) >= 0) {
          throw TypeError("Converting circular structure to JSON5");
        }
        stack.push(value2);
        let stepback = indent;
        indent = indent + gap;
        let partial = [];
        for (let i = 0; i < value2.length; i++) {
          const propertyString = serializeProperty(String(i), value2);
          partial.push(propertyString !== void 0 ? propertyString : "null");
        }
        let final;
        if (partial.length === 0) {
          final = "[]";
        } else {
          if (gap === "") {
            let properties = partial.join(",");
            final = "[" + properties + "]";
          } else {
            let separator = ",\n" + indent;
            let properties = partial.join(separator);
            final = "[\n" + indent + properties + ",\n" + stepback + "]";
          }
        }
        stack.pop();
        indent = stepback;
        return final;
      }
    };
  }
});

// node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/index.js
var require_lib = __commonJS({
  "node_modules/.pnpm/json5@2.2.3/node_modules/json5/lib/index.js"(exports2, module2) {
    var parse = require_parse();
    var stringify = require_stringify();
    var JSON5 = {
      parse,
      stringify
    };
    module2.exports = JSON5;
  }
});

// node_modules/.pnpm/@deeptalk+plugin-sdk@file+..+..+packages+plugin-sdk/node_modules/@deeptalk/plugin-sdk/dist/parseToolInput.js
var require_parseToolInput = __commonJS({
  "node_modules/.pnpm/@deeptalk+plugin-sdk@file+..+..+packages+plugin-sdk/node_modules/@deeptalk/plugin-sdk/dist/parseToolInput.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.parseToolInput = parseToolInput2;
    var json5_1 = __importDefault(require_lib());
    function isPlainObject(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    function parseToolInput2(input) {
      if (input == null)
        return { ok: true, value: {}, message: "" };
      if (isPlainObject(input)) {
        return { ok: true, value: input, message: "" };
      }
      if (typeof input !== "string") {
        return { ok: false, value: {}, message: "Parameters must be a JSON object string" };
      }
      const trimmed = input.trim();
      if (!trimmed)
        return { ok: true, value: {}, message: "" };
      const tryParse = (parser) => {
        try {
          return parser(trimmed);
        } catch {
          return void 0;
        }
      };
      const parsed = tryParse(JSON.parse) ?? tryParse(json5_1.default.parse);
      if (!isPlainObject(parsed)) {
        return {
          ok: false,
          value: {},
          message: 'Invalid JSON parameters: expected a JSON object, for example {"file_path":"README.md"}'
        };
      }
      return { ok: true, value: parsed, message: "" };
    }
  }
});

// node_modules/.pnpm/@deeptalk+plugin-sdk@file+..+..+packages+plugin-sdk/node_modules/@deeptalk/plugin-sdk/dist/resolvePath.js
var require_resolvePath = __commonJS({
  "node_modules/.pnpm/@deeptalk+plugin-sdk@file+..+..+packages+plugin-sdk/node_modules/@deeptalk/plugin-sdk/dist/resolvePath.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.resolvePath = resolvePath2;
    exports2.resolveWithinRoot = resolveWithinRoot;
    exports2.isWithinRoot = isWithinRoot;
    exports2.toWorkspaceRelativePath = toWorkspaceRelativePath;
    exports2.shortenForDisplay = shortenForDisplay;
    var path_1 = __importDefault(require("path"));
    var os_1 = __importDefault(require("os"));
    function resolvePath2(workspaceRoot, userPath) {
      let expanded = userPath;
      if (expanded.startsWith("~/") || expanded === "~") {
        expanded = path_1.default.join(os_1.default.homedir(), expanded.slice(1));
      }
      const absolute = path_1.default.isAbsolute(expanded) ? path_1.default.resolve(expanded) : path_1.default.resolve(workspaceRoot, expanded);
      return {
        absolute,
        withinWorkspace: isWithinRoot(workspaceRoot, absolute)
      };
    }
    function resolveWithinRoot(workspaceRoot, relativePath) {
      if (!workspaceRoot)
        return null;
      const rootReal = path_1.default.resolve(workspaceRoot);
      const normalized = path_1.default.normalize(relativePath).replace(/^[\/.[\\]/, "");
      const resolved = path_1.default.resolve(rootReal, normalized);
      const relative = path_1.default.relative(rootReal, resolved);
      if (relative.startsWith("..") || path_1.default.isAbsolute(relative))
        return null;
      return resolved;
    }
    function isWithinRoot(workspaceRoot, targetPath) {
      if (!workspaceRoot || !targetPath)
        return false;
      const rootReal = path_1.default.resolve(workspaceRoot);
      const targetReal = path_1.default.resolve(targetPath);
      const relative = path_1.default.relative(rootReal, targetReal);
      return !relative.startsWith("..") && !path_1.default.isAbsolute(relative);
    }
    function toWorkspaceRelativePath(workspaceRoot, targetPath) {
      if (!isWithinRoot(workspaceRoot, targetPath))
        return null;
      const rootReal = path_1.default.resolve(workspaceRoot);
      const targetReal = path_1.default.resolve(targetPath);
      const relative = path_1.default.relative(rootReal, targetReal);
      return relative.split(path_1.default.sep).join("/");
    }
    function shortenForDisplay(absPath) {
      const home = os_1.default.homedir();
      if (absPath.startsWith(home)) {
        return "~" + absPath.slice(home.length);
      }
      return absPath;
    }
  }
});

// node_modules/.pnpm/@deeptalk+plugin-sdk@file+..+..+packages+plugin-sdk/node_modules/@deeptalk/plugin-sdk/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/@deeptalk+plugin-sdk@file+..+..+packages+plugin-sdk/node_modules/@deeptalk/plugin-sdk/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.shortenForDisplay = exports2.toWorkspaceRelativePath = exports2.isWithinRoot = exports2.resolvePath = exports2.parseToolInput = void 0;
    var parseToolInput_1 = require_parseToolInput();
    Object.defineProperty(exports2, "parseToolInput", { enumerable: true, get: function() {
      return parseToolInput_1.parseToolInput;
    } });
    var resolvePath_1 = require_resolvePath();
    Object.defineProperty(exports2, "resolvePath", { enumerable: true, get: function() {
      return resolvePath_1.resolvePath;
    } });
    Object.defineProperty(exports2, "isWithinRoot", { enumerable: true, get: function() {
      return resolvePath_1.isWithinRoot;
    } });
    Object.defineProperty(exports2, "toWorkspaceRelativePath", { enumerable: true, get: function() {
      return resolvePath_1.toWorkspaceRelativePath;
    } });
    Object.defineProperty(exports2, "shortenForDisplay", { enumerable: true, get: function() {
      return resolvePath_1.shortenForDisplay;
    } });
  }
});

// src/publish.ts
var publish_exports = {};
__export(publish_exports, {
  tool: () => tool
});
module.exports = __toCommonJS(publish_exports);

// src/preflight.ts
var import_fs3 = require("fs");
var import_path3 = __toESM(require("path"));

// src/shared.ts
var import_fs2 = require("fs");
var import_path2 = __toESM(require("path"));
var import_child_process = require("child_process");
var import_plugin_sdk = __toESM(require_dist());

// src/readWorkspaceMeta.ts
var import_fs = require("fs");
var import_path = __toESM(require("path"));

// src/ids.ts
var PLUGIN_ID = "vitalspan";
var PLUGIN_VERSION = "0.3.1";
var TEMPLATE_ID = "vitalspan.bi.default";
var TEMPLATE_VERSION = "1.0.0";
var DOMAIN_KEY = "vitalspan";

// src/instanceConfig.ts
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function normalizeUrl(url, trailingSlash) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trailingSlash ? `${trimmed}/` : trimmed;
}
function parseBinding(raw) {
  if (!isRecord(raw)) return null;
  const mode = raw.mode;
  const apiBaseUrl = raw.apiBaseUrl ?? raw.api_base;
  const feAdminUrl = raw.feAdminUrl ?? raw.fe_base;
  if (mode !== "demo" && mode !== "live") return null;
  if (typeof apiBaseUrl !== "string" || !apiBaseUrl.startsWith("http")) return null;
  if (typeof feAdminUrl !== "string" || !feAdminUrl.startsWith("http")) return null;
  return {
    mode,
    apiBaseUrl: normalizeUrl(apiBaseUrl, false),
    feAdminUrl: normalizeUrl(feAdminUrl, false)
  };
}
function readDomainBinding(instanceConfig) {
  if (!isRecord(instanceConfig)) {
    return { ok: false, reason: "\u672A\u7ED1\u5B9A VitalSpan\uFF1A\u8BF7\u5148\u5B8C\u6210\u5DE5\u4F5C\u533A\u521B\u5EFA\u5411\u5BFC" };
  }
  const pluginRaw = instanceConfig.plugin;
  if (!isRecord(pluginRaw)) {
    return { ok: false, reason: "instanceConfig.plugin \u7F3A\u5931" };
  }
  if (pluginRaw.id !== PLUGIN_ID) {
    return { ok: false, reason: `plugin.id \u5E94\u4E3A ${PLUGIN_ID}\uFF0C\u5F53\u524D\u4E3A ${String(pluginRaw.id)}` };
  }
  const binding = parseBinding(instanceConfig[DOMAIN_KEY]);
  if (!binding) {
    return {
      ok: false,
      reason: `instanceConfig.${DOMAIN_KEY} \u65E0\u6548\uFF1A\u9700\u8981 mode(demo|live)\u3001apiBaseUrl\u3001feAdminUrl`
    };
  }
  return {
    ok: true,
    plugin: {
      id: PLUGIN_ID,
      version: typeof pluginRaw.version === "string" ? pluginRaw.version : PLUGIN_VERSION,
      templateId: typeof pluginRaw.templateId === "string" ? pluginRaw.templateId : TEMPLATE_ID,
      templateVersion: typeof pluginRaw.templateVersion === "string" ? pluginRaw.templateVersion : TEMPLATE_VERSION
    },
    binding
  };
}

// src/readWorkspaceMeta.ts
function readBindingEndpointsFromFile(workspaceRoot) {
  const candidates = [".deeptalk/workspace.json", "workspace.json"];
  for (const rel of candidates) {
    const p = import_path.default.join(workspaceRoot, rel);
    if (!(0, import_fs.existsSync)(p)) continue;
    try {
      const doc = JSON.parse((0, import_fs.readFileSync)(p, "utf-8"));
      const ic = doc.instanceConfig ?? doc;
      const parsed = readDomainBinding(
        typeof ic === "object" && ic !== null && !Array.isArray(ic) ? ic : void 0
      );
      if (parsed.ok) {
        return {
          apiBaseUrl: parsed.binding.apiBaseUrl,
          feAdminUrl: parsed.binding.feAdminUrl
        };
      }
    } catch {
    }
  }
  return {};
}

// src/shared.ts
function pluginRootDir() {
  return import_path2.default.join(__dirname, "..");
}
function loadConfig(ctx) {
  let defaults = {};
  const pluginDefaultsPath = import_path2.default.join(pluginRootDir(), "assets", "defaults.json");
  if ((0, import_fs2.existsSync)(pluginDefaultsPath)) {
    defaults = JSON.parse((0, import_fs2.readFileSync)(pluginDefaultsPath, "utf-8"));
  }
  let wsVs = {};
  for (const name of ["local.config.json", "config.json"]) {
    const cfgPath = import_path2.default.join(ctx.workspaceRoot, name);
    if ((0, import_fs2.existsSync)(cfgPath)) {
      const ws = JSON.parse((0, import_fs2.readFileSync)(cfgPath, "utf-8"));
      wsVs = ws.vitalspan ?? ws;
      break;
    }
  }
  const fromInstance = readBindingEndpointsFromFile(ctx.workspaceRoot);
  const merged = { ...defaults, ...wsVs };
  const envApi = process.env.VITALSPAN_API?.replace(/\/$/, "");
  const envFe = process.env.VITALSPAN_FE;
  return {
    apiBase: (envApi ?? fromInstance.apiBaseUrl ?? merged.api_base ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, ""),
    feBase: envFe ?? fromInstance.feAdminUrl ?? merged.fe_base ?? "http://127.0.0.1:5173/admin",
    username: process.env.VITALSPAN_USERNAME ?? merged.username ?? "admin",
    password: process.env.VITALSPAN_DEV_ADMIN_PASSWORD ?? merged.password_default ?? "changeme",
    vitalspanRoot: process.env.VITALSPAN_ROOT ?? merged.vitalspan_root
  };
}
var DEFAULT_REQUEST_TIMEOUT_MS = 6e4;
async function requestJson(method, url, body, token, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const headers = { Accept: "application/json" };
  if (body !== void 0) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === void 0 ? void 0 : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${method} ${url} -> ${res.status}
${text}`);
    }
    if (res.status === 204 || !text) {
      return {};
    }
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`${method} ${url} timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
async function login(cfg) {
  const data = await requestJson(
    "POST",
    `${cfg.apiBase}/auth/login`,
    { username: cfg.username, password: cfg.password }
  );
  const token = data.accessToken ?? data.access_token;
  if (!token) {
    throw new Error("login missing accessToken; is VitalSpan API running?");
  }
  return token;
}
function resolveBundlePath(ctx, fileArg) {
  const resolved = (0, import_plugin_sdk.resolvePath)(ctx.workspaceRoot, fileArg);
  if (!resolved.withinWorkspace) {
    throw new Error(`path must be inside workspace: ${fileArg}`);
  }
  const rel = import_path2.default.relative(ctx.workspaceRoot, resolved.absolute).replace(/\\/g, "/");
  const parts = rel.split("/");
  if (parts[0] === "output" || parts[0] === "dist") {
    throw new Error(
      `refusing publish from ${parts[0]}/; write to examples/ or use publish param from with output path`
    );
  }
  return resolved.absolute;
}
function copyFromOutput(ctx, fromArg) {
  const resolved = (0, import_plugin_sdk.resolvePath)(ctx.workspaceRoot, fromArg);
  if (!resolved.withinWorkspace) {
    throw new Error(`path must be inside workspace: ${fromArg}`);
  }
  const examplesDir = import_path2.default.join(ctx.workspaceRoot, "examples");
  (0, import_fs2.mkdirSync)(examplesDir, { recursive: true });
  const dest = import_path2.default.join(examplesDir, import_path2.default.basename(resolved.absolute));
  (0, import_fs2.copyFileSync)(resolved.absolute, dest);
  return dest;
}
function readBundle(filePath) {
  const raw = (0, import_fs2.readFileSync)(filePath, "utf-8");
  const bundle = JSON.parse(raw);
  if (!bundle.manifest || typeof bundle.files !== "object") {
    throw new Error("bundle must have manifest and files");
  }
  const files = bundle.files;
  const manifest = bundle.manifest;
  const entry = manifest.entry || "index.html";
  const html = files[entry];
  if (typeof html !== "string") {
    throw new Error(`files.${entry} must be a string`);
  }
  const runtime = manifest.runtime;
  if (runtime === "d3" && !html.includes("vsCv.mount(")) {
    throw new Error("d3 bundle must include host.vsCv.mount(");
  }
  if (!html.includes("p.style") && !html.includes("(p && p.style)")) {
    console.warn("warn: bundle may not read p.style; style panel may not work");
  }
  return bundle;
}
function tryPythonPublish(ctx, cfg, fileArg, artifactId, options) {
  let bundlePath = fileArg;
  if (!import_path2.default.isAbsolute(fileArg)) {
    try {
      bundlePath = resolveBundlePath(ctx, fileArg);
    } catch {
      bundlePath = import_path2.default.resolve(ctx.workspaceRoot, fileArg);
    }
  } else {
    bundlePath = import_path2.default.resolve(fileArg);
  }
  if (!(0, import_fs2.existsSync)(bundlePath)) {
    return null;
  }
  const fileForPy = bundlePath.replace(/\\/g, "/");
  const cliCandidates = [
    import_path2.default.join(ctx.workspaceRoot, "deeptalk-product", "executor", "cli.py"),
    import_path2.default.join(ctx.workspaceRoot, "tools", "..", "deeptalk-product", "executor", "cli.py")
  ];
  if (cfg.vitalspanRoot) {
    cliCandidates.push(
      import_path2.default.join(cfg.vitalspanRoot, "docs/api/vs-ai-spec/deeptalk-product/executor/cli.py")
    );
  }
  let cliPath;
  for (const c of cliCandidates) {
    if ((0, import_fs2.existsSync)(c)) {
      cliPath = c;
      break;
    }
  }
  const publishScriptCandidates = [];
  if (cfg.vitalspanRoot) {
    publishScriptCandidates.push(
      import_path2.default.join(cfg.vitalspanRoot, "docs/api/vs-ai-spec/tools/publish-ai-viz-artifact.py")
    );
  }
  publishScriptCandidates.push(import_path2.default.join(ctx.workspaceRoot, "tools", "publish-ai-viz-artifact.py"));
  const env = { ...process.env, VITALSPAN_API: cfg.apiBase };
  if (cfg.vitalspanRoot) {
    env.VITALSPAN_ROOT = cfg.vitalspanRoot;
  }
  env.VITALSPAN_USERNAME = cfg.username;
  env.VITALSPAN_DEV_ADMIN_PASSWORD = cfg.password;
  env.VITALSPAN_WORKSPACE = ctx.workspaceRoot;
  if (cliPath) {
    const args = [cliPath, "vitalspan_publish_artifact", "--file", fileForPy];
    if (artifactId) args.push("--artifact-id", artifactId);
    if (options?.validateOnly) args.push("--validate-only");
    const proc = (0, import_child_process.spawnSync)("python", args, {
      cwd: ctx.workspaceRoot,
      env,
      encoding: "utf-8"
    });
    const out = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
    if (proc.status !== 0) {
      throw new Error(out || "python publish failed");
    }
    return out;
  }
  for (const script of publishScriptCandidates) {
    if (!(0, import_fs2.existsSync)(script)) continue;
    const args = [script, "--file", fileForPy];
    if (artifactId) args.push("--artifact-id", artifactId);
    if (options?.validateOnly) args.push("--validate-only");
    const proc = (0, import_child_process.spawnSync)("python", args, {
      cwd: ctx.workspaceRoot,
      env,
      encoding: "utf-8"
    });
    const out = `${proc.stdout ?? ""}${proc.stderr ?? ""}`;
    if (proc.status !== 0) {
      throw new Error(out || "python publish failed");
    }
    return out;
  }
  return null;
}
function parseInput(callInput) {
  return (0, import_plugin_sdk.parseToolInput)(callInput);
}
function relWorkspacePath(ctx, absPath) {
  return import_path2.default.relative(ctx.workspaceRoot, absPath).replace(/\\/g, "/");
}

// src/preflight.ts
var INLINE_D3_MIN_BYTES = 200 * 1024;
var MAX_BUNDLE_BYTES = 2 * 1024 * 1024;
var ALLOWED_RUNTIMES = /* @__PURE__ */ new Set(["html", "d3"]);
var FORBIDDEN_PATTERNS = [
  { re: /<script[^>]+src\s*=/i, code: "AIVIZ_UNSAFE_CONTENT" },
  { re: /(?<![.\w])on\w+\s*=/i, code: "AIVIZ_UNSAFE_CONTENT" },
  { re: /javascript:/i, code: "AIVIZ_UNSAFE_CONTENT" },
  { re: /\bid=["']app["']/i, code: "AIVIZ_FORBIDDEN_HOST_ID" },
  { re: /\bid=["']root["']/i, code: "AIVIZ_FORBIDDEN_HOST_ID" }
];
var FICTION_API_PATTERNS = [
  { re: /getStyle\s*\(/i, message: "host.vsCv.getStyle() does not exist" },
  { re: /vs-cv-style-update/i, message: "vs-cv-style-update event does not exist" },
  { re: /\.vs-cv-style\b/i, message: ".vs-cv-style selector/API does not exist" }
];
var hintCache = null;
function loadHints() {
  if (hintCache) return hintCache;
  const bundled = import_path3.default.join(pluginRootDir(), "assets", "aiviz-publish-hints.json");
  try {
    hintCache = JSON.parse((0, import_fs3.readFileSync)(bundled, "utf-8"));
  } catch {
    hintCache = {
      AIVIZ_INVALID_MANIFEST: "\u590D\u5236 examples/html-minimal.json\uFF1BfieldSlots + styleSchema \u5FC5\u586B\uFF1B\u660E\u7EC6\u8868 metrics.min \u53EF\u4E3A 0",
      AIVIZ_UNSAFE_CONTENT: "\u7981\u6B62 onclick=/onmouseenter= HTML\u3001script src\u3002\u60AC\u505C\u6682\u505C\u7528 CSS animation-play-state",
      AIVIZ_FORBIDDEN_HOST_ID: '\u7981\u6B62 id="app"/"root"\uFF0C\u6539\u7528 id="vs-cv-*"',
      AIVIZ_MOUNT_REQUIRED: "d3 \u5FC5\u987B host.vsCv.mount(renderFn)",
      AIVIZ_INLINE_D3_FORBIDDEN: "\u7981\u6B62\u5185\u8054 d3\uFF1B\u7528 host.vsCv.d3",
      AIVIZ_FICTION_API: "\u6837\u5F0F\u53EA\u8BFB (p&&p.style)||{}\uFF1B\u52FF getStyle / vs-cv-style-update"
    };
  }
  return hintCache;
}
function hintFor(code, message) {
  const hints = loadHints();
  if (hints[code]) return hints[code];
  if (message.includes("fieldSlots")) return hints.AIVIZ_INVALID_MANIFEST;
  if (message.includes("forbidden pattern")) return hints.AIVIZ_UNSAFE_CONTENT;
  if (message.includes('id="app"') || message.includes('id="root"')) {
    return hints.AIVIZ_FORBIDDEN_HOST_ID;
  }
  return void 0;
}
function pushError(lines, code, message) {
  lines.push(`[422] ${code}: ${message}`);
  const hint = hintFor(code, message);
  if (hint) lines.push(`  \u2192 \u4FEE\u590D: ${hint}`);
  lines.push("  \u2192 \u91D1\u6837: examples/html-minimal.json\uFF08\u9ED8\u8BA4\uFF09\xB7 guides/CUSTOM-VIZ-AUTHOR.md");
}
function pushWarn(lines, code, message) {
  lines.push(`  [warn] ${code}: ${message}`);
  const hint = loadHints()[code];
  if (hint) lines.push(`  \u2192 \u5EFA\u8BAE: ${hint}`);
}
function resolveRuntime(manifest) {
  const runtime = manifest.runtime;
  if (typeof runtime === "string") return runtime;
  const hint = manifest.rendererHint;
  return hint === "d3" ? "d3" : "html";
}
function validateFieldSlotMin(key, rule, fieldSlots) {
  const min = rule.min;
  if (key === "metrics") {
    const dimRule = fieldSlots.dimensions;
    const dimMax = dimRule && typeof dimRule === "object" && typeof dimRule.max === "number" ? dimRule.max : 1;
    if (dimMax > 1 && min === 0) return null;
  }
  if (typeof min !== "number" || min < 1) {
    return `manifest.fieldSlots.${key}.min must be >= 1`;
  }
  return null;
}
function scanFileContent(lines, name, content, manifest, isEntry) {
  const encoded = Buffer.byteLength(content, "utf-8");
  if (encoded >= INLINE_D3_MIN_BYTES && content.includes("d3.version")) {
    pushError(lines, "AIVIZ_INLINE_D3_FORBIDDEN", `inline d3 library detected in ${name}`);
  }
  for (const { re, code } of FORBIDDEN_PATTERNS) {
    if (re.test(content)) {
      pushError(lines, code, `forbidden pattern in ${name}`);
      break;
    }
  }
  for (const { re, message } of FICTION_API_PATTERNS) {
    if (re.test(content)) {
      pushError(lines, "AIVIZ_FICTION_API", `${message} in ${name}`);
    }
  }
  if (isEntry) {
    const runtime = resolveRuntime(manifest);
    if (runtime === "d3" && !content.includes("vsCv.mount(")) {
      pushError(lines, "AIVIZ_MOUNT_REQUIRED", "d3 runtime must call host.vsCv.mount(renderFn)");
    }
    if (runtime === "html" && !content.includes("vsCv.mount(")) {
      pushWarn(
        lines,
        "AIVIZ_WARN_MOUNT_RECOMMENDED",
        "html runtime should call host.vsCv.mount(renderFn)"
      );
    }
    if (!content.includes("p.style") && !content.includes("(p && p.style)")) {
      pushWarn(
        lines,
        "AIVIZ_WARN_STYLE_COMPLIANCE",
        "bundle may not read p.style; style panel may not work"
      );
    }
  }
}
function localPreflightBundle(bundle) {
  const lines = [];
  const manifest = bundle.manifest;
  const files = bundle.files;
  if (!manifest || typeof manifest !== "object") {
    pushError(lines, "AIVIZ_INVALID_MANIFEST", "manifest must be an object");
    return { ok: false, lines: ["preflight FAILED:", ...lines] };
  }
  if (!files || typeof files !== "object" || Object.keys(files).length === 0) {
    pushError(lines, "AIVIZ_INVALID_FILES", "files must be a non-empty object");
    return { ok: false, lines: ["preflight FAILED:", ...lines] };
  }
  const m = manifest;
  const runtime = resolveRuntime(m);
  if (!ALLOWED_RUNTIMES.has(runtime)) {
    pushError(lines, "AIVIZ_INVALID_MANIFEST", "manifest.runtime must be 'html' or 'd3'");
  }
  const fieldSlots = m.fieldSlots;
  if (!fieldSlots || typeof fieldSlots !== "object") {
    pushError(
      lines,
      "AIVIZ_INVALID_MANIFEST",
      "manifest.fieldSlots is required (dimensions + metrics)"
    );
  } else {
    const slots = fieldSlots;
    for (const key of ["dimensions", "metrics"]) {
      const rule = slots[key];
      if (!rule || typeof rule !== "object") {
        pushError(lines, "AIVIZ_INVALID_MANIFEST", `manifest.fieldSlots.${key} is required`);
        continue;
      }
      const err = validateFieldSlotMin(key, rule, slots);
      if (err) pushError(lines, "AIVIZ_INVALID_MANIFEST", err);
    }
    const dimRule = slots.dimensions;
    const metricRule = slots.metrics;
    const dimMax = typeof dimRule?.max === "number" ? dimRule.max : 1;
    const metricMin = typeof metricRule?.min === "number" ? metricRule.min : 1;
    const metricMax = typeof metricRule?.max === "number" ? metricRule.max : 1;
    if (dimMax > 1 && metricMin >= 1 && metricMax > 0) {
      pushWarn(
        lines,
        "AIVIZ_WARN_DETAIL_TABLE_METRICS",
        "fieldSlots \u4E0E P2 \u591A\u7EF4\u660E\u7EC6\u8303\u5F0F\u4E0D\u7B26\uFF08dimensions.max>1 \u65F6 metrics \u987B min=0,max=0\uFF09"
      );
    }
  }
  const styleSchema = m.styleSchema;
  if (!styleSchema || typeof styleSchema !== "object") {
    pushError(lines, "AIVIZ_INVALID_MANIFEST", "manifest.styleSchema is required");
  } else {
    const props = styleSchema.properties;
    if (!props || typeof props !== "object" || Object.keys(props).length === 0) {
      pushError(lines, "AIVIZ_INVALID_MANIFEST", "manifest.styleSchema.properties must not be empty");
    }
  }
  const entry = m.entry || "index.html";
  const fileMap = files;
  let totalBytes = 0;
  for (const [name, raw] of Object.entries(fileMap)) {
    if (typeof raw !== "string") {
      pushError(lines, "AIVIZ_INVALID_FILES", `files.${name} must be a string`);
      continue;
    }
    totalBytes += Buffer.byteLength(raw, "utf-8");
    if (!name.endsWith(".html") && !name.endsWith(".css") && !name.endsWith(".svg")) {
      pushError(lines, "AIVIZ_INVALID_FILE", `unsupported file name: ${name}`);
    }
    scanFileContent(lines, name, raw, m, name === entry);
  }
  if (totalBytes > MAX_BUNDLE_BYTES) {
    pushError(lines, "AIVIZ_BUNDLE_TOO_LARGE", "bundle exceeds 2MB limit");
  }
  if (!(entry in fileMap)) {
    pushError(lines, "AIVIZ_MISSING_ENTRY", `files must include entry ${entry}`);
  }
  if (lines.some((l) => l.startsWith("[422]"))) {
    return { ok: false, lines: ["preflight FAILED:", ...lines] };
  }
  return {
    ok: true,
    lines: ["preflight ok (plugin local; full lint needs VITALSPAN_ROOT or Python CLI)", ...lines.filter((l) => l.startsWith("  [warn]"))]
  };
}
function formatHttpPublishError(status, body) {
  try {
    const parsed = JSON.parse(body);
    const code = parsed.code ?? "HTTP_ERROR";
    const message = parsed.message ?? body;
    return ["publish FAILED:", ...formatErrorBlock(code, message, status)].join("\n");
  } catch {
    return `publish FAILED: ${status}
${body}`;
  }
}
function formatErrorBlock(code, message, httpStatus = 422) {
  const lines = [`[${httpStatus}] ${code}: ${message}`];
  const hint = hintFor(code, message);
  if (hint) lines.push(`  \u2192 \u4FEE\u590D: ${hint}`);
  lines.push("  \u2192 \u91D1\u6837: examples/html-minimal.json\uFF08\u9ED8\u8BA4\uFF09\xB7 guides/CUSTOM-VIZ-AUTHOR.md");
  return lines;
}

// src/validateGate.ts
var import_crypto = require("crypto");
var import_fs4 = require("fs");
var import_path4 = __toESM(require("path"));
function normalizeRel(relPath) {
  return relPath.replace(/\\/g, "/");
}
function cacheFile(ctx) {
  return import_path4.default.join(ctx.workspaceRoot, ".vitalspan", "validate-stamps.json");
}
function loadCache(ctx) {
  const file = cacheFile(ctx);
  if (!(0, import_fs4.existsSync)(file)) return {};
  try {
    return JSON.parse((0, import_fs4.readFileSync)(file, "utf-8"));
  } catch {
    return {};
  }
}
function computeBundleFingerprint(bundle) {
  const manifest = bundle.manifest ?? {};
  const filesRaw = bundle.files;
  const sortedFiles = {};
  if (filesRaw && typeof filesRaw === "object") {
    const keys = Object.keys(filesRaw).sort();
    for (const key of keys) {
      const val = filesRaw[key];
      if (typeof val === "string") sortedFiles[key] = val;
    }
  }
  const payload = JSON.stringify({ manifest, files: sortedFiles });
  return (0, import_crypto.createHash)("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}
function checkValidateGate(ctx, relPath, fingerprint) {
  const rel = normalizeRel(relPath);
  const entry = loadCache(ctx)[rel];
  if (!entry) {
    return {
      ok: false,
      lines: [
        "publish blocked: no validate stamp for this bundle",
        `  \u2192 \u5148\u8FD0\u884C: vitalspan_validate_artifact file=${rel}`,
        "  \u2192 publish \u786C\u95E8\u7981\uFF1A\u7981\u6B62\u8DF3\u8FC7 validate \u76F2\u8BD5 POST"
      ]
    };
  }
  if (entry.fingerprint !== fingerprint) {
    return {
      ok: false,
      lines: [
        "publish blocked: bundle changed since last validate",
        `  \u2192 \u4E0A\u6B21 validate: ${entry.validatedAt} (${entry.mode})`,
        `  \u2192 \u91CD\u65B0\u8FD0\u884C: vitalspan_validate_artifact file=${rel}`
      ]
    };
  }
  return { ok: true };
}

// src/publish.ts
var tool = {
  info() {
    return {
      name: "vitalspan_publish_artifact",
      displayName: "VitalSpan \u7EC4\u4EF6\u5165\u5E93",
      description: [
        "Requires prior vitalspan_validate_artifact on same bundle (validate stamp gate).",
        "Then POST/PUT customViz bundle (workflow 2). On failure returns fix hints \u2014 do NOT blind retry.",
        "Target: ok artifactId=... styleComplianceTier=full (no warnings)."
      ].join(" "),
      parameters: {
        file: {
          type: "string",
          description: "Bundle path under workspace, e.g. examples/my-widget.json"
        },
        from: {
          type: "string",
          description: "Copy from output/ or other path into examples/ then publish"
        },
        artifact_id: {
          type: "string",
          description: "Existing uuid for PUT update"
        }
      },
      timeoutMs: 12e4
    };
  },
  async run(ctx, call) {
    const parsed = parseInput(call.input);
    if (!parsed.ok) {
      return { toolCallId: call.id, content: parsed.message, isError: true };
    }
    const file = parsed.value.file;
    const from = parsed.value.from;
    const artifactId = parsed.value.artifact_id;
    if (!file && !from) {
      return {
        toolCallId: call.id,
        content: "file or from required",
        isError: true
      };
    }
    try {
      const cfg = loadConfig(ctx);
      let absPath;
      if (from) {
        absPath = copyFromOutput(ctx, from);
      } else {
        absPath = resolveBundlePath(ctx, file);
      }
      const rel = relWorkspacePath(ctx, absPath);
      const bundle = readBundle(absPath);
      const fingerprint = computeBundleFingerprint(bundle);
      const gate = checkValidateGate(ctx, rel, fingerprint);
      if (!gate.ok) {
        return {
          toolCallId: call.id,
          content: gate.lines.join("\n"),
          isError: true
        };
      }
      const pyOut = tryPythonPublish(ctx, cfg, rel, artifactId);
      if (pyOut !== null) {
        const failed = pyOut.includes("preflight FAILED") || pyOut.includes("SystemExit") || !pyOut.includes("ok artifactId=") && !artifactId;
        return { toolCallId: call.id, content: pyOut.trim(), isError: failed };
      }
      const preflight = localPreflightBundle(bundle);
      if (!preflight.ok) {
        return {
          toolCallId: call.id,
          content: preflight.lines.join("\n"),
          isError: true
        };
      }
      const token = await login(cfg);
      let result;
      if (artifactId) {
        result = await requestJson(
          "PUT",
          `${cfg.apiBase}/ai-viz/artifacts/${artifactId}`,
          bundle,
          token
        );
      } else {
        result = await requestJson(
          "POST",
          `${cfg.apiBase}/ai-viz/artifacts`,
          bundle,
          token
        );
      }
      const aid = result.artifactId ?? result.artifact_id;
      const tier = result.styleComplianceTier ?? result.style_compliance_tier ?? "?";
      if (!aid) {
        throw new Error(`publish missing artifactId: ${JSON.stringify(result)}`);
      }
      const lines = [
        `ok artifactId=${aid}`,
        `styleComplianceTier=${tier}`,
        `warnings=${Array.isArray(result.warnings) ? result.warnings.length : 0}`,
        `entry GET ${cfg.apiBase}/ai-viz/artifacts/${aid}/entry`,
        `verify ${cfg.feBase} chart picker custom tab`
      ];
      if (tier !== "full") {
        lines.push(
          "CHECKLIST: fix mount + p.style + Chinese styleSchema.title; then PUT same artifact-id"
        );
      }
      return { toolCallId: call.id, content: lines.join("\n"), isError: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const httpMatch = msg.match(/^(POST|PUT) .* -> (\d+)\n([\s\S]*)$/);
      if (httpMatch) {
        return {
          toolCallId: call.id,
          content: formatHttpPublishError(Number(httpMatch[2]), httpMatch[3]),
          isError: true
        };
      }
      return { toolCallId: call.id, content: msg, isError: true };
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  tool
});
