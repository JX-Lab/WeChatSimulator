(function () {
	function padCallUnit(value) {
		return value < 10 ? "0" + value : String(value);
	}

	function clamp(value, min, max) {
		value = parseInt(value, 10);
		if (isNaN(value)) value = min;
		if (value < min) value = min;
		if (value > max) value = max;
		return value;
	}

	function parseCallDurationParts(value) {
		var raw = String(value == null ? "" : value).trim();
		var match;
		var hours;
		var minutes;
		var seconds;
		var total;

		if (!raw) {
			return { hours: 0, minutes: 0, seconds: 0 };
		}

		if (/^\d+$/.test(raw)) {
			total = Math.max(0, parseInt(raw, 10));
			hours = Math.floor(total / 3600);
			minutes = Math.floor((total % 3600) / 60);
			seconds = total % 60;
			return { hours: hours, minutes: minutes, seconds: seconds };
		}

		match = raw.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
		if (!match) {
			return { hours: 0, minutes: 0, seconds: 32 };
		}

		if (typeof match[3] !== "undefined") {
			hours = clamp(match[1], 0, 23);
			minutes = clamp(match[2], 0, 59);
			seconds = clamp(match[3], 0, 59);
		} else {
			hours = 0;
			minutes = clamp(match[1], 0, 59);
			seconds = clamp(match[2], 0, 59);
		}

		return { hours: hours, minutes: minutes, seconds: seconds };
	}

	function formatCallDuration(hours, minutes, seconds) {
		hours = clamp(hours, 0, 23);
		minutes = clamp(minutes, 0, 59);
		seconds = clamp(seconds, 0, 59);
		if (hours > 0) {
			return padCallUnit(hours) + ":" + padCallUnit(minutes) + ":" + padCallUnit(seconds);
		}
		return padCallUnit(minutes) + ":" + padCallUnit(seconds);
	}

	function getCallStatusText(status, durationText, isMe) {
		if (status === "connected") {
			return "通话时长 " + (durationText || "00:32");
		}
		if (status === "canceled") return isMe ? "已取消" : "对方已取消";
		if (status === "peer_canceled") return "对方已取消";
		if (status === "rejected") return "已拒绝";
		if (status === "unanswered") return "无应答";
		if (status === "peer_unanswered") return "对方未接听";
		if (status === "callback_missed") return "未接听 点击回拨";
		if (status === "failed") return "连接失败";
		return isMe ? "已取消" : "对方已取消";
	}

	function ensureSetting(vm, key, value) {
		if (typeof vm.setting[key] === "undefined") {
			vm.$set(vm.setting, key, value);
		}
	}

	function normalizeCallStatus(status) {
		if (status === "missed") return "unanswered";
		return status || "connected";
	}

	function normalizeCallSettings(vm) {
		var hasParts =
			typeof vm.setting.dialog_call_hours !== "undefined" ||
			typeof vm.setting.dialog_call_minutes !== "undefined" ||
			typeof vm.setting.dialog_call_seconds !== "undefined";
		var parts = hasParts
			? {
				hours: clamp(vm.setting.dialog_call_hours, 0, 23),
				minutes: clamp(vm.setting.dialog_call_minutes, 0, 59),
				seconds: clamp(vm.setting.dialog_call_seconds, 0, 59)
			}
			: parseCallDurationParts(vm.setting.dialog_call_duration || "00:32");

		ensureSetting(vm, "dialog_call_status", "connected");
		ensureSetting(vm, "dialog_call_show_unread", "0");
		vm.$set(vm.setting, "dialog_call_status", normalizeCallStatus(vm.setting.dialog_call_status));
		vm.$set(vm.setting, "dialog_call_hours", parts.hours);
		vm.$set(vm.setting, "dialog_call_minutes", parts.minutes);
		vm.$set(vm.setting, "dialog_call_seconds", parts.seconds);
		vm.$set(vm.setting, "dialog_call_duration", formatCallDuration(parts.hours, parts.minutes, parts.seconds));
	}

	function applyCallDialogMetadata(vm, dialog) {
		var parts;
		var durationText;

		if (!dialog.call_mode) vm.$set(dialog, "call_mode", "voice");
		vm.$set(dialog, "call_status", normalizeCallStatus(dialog.call_status));

		if (
			typeof dialog.call_hours !== "undefined" ||
			typeof dialog.call_minutes !== "undefined" ||
			typeof dialog.call_seconds !== "undefined"
		) {
			parts = {
				hours: clamp(dialog.call_hours, 0, 23),
				minutes: clamp(dialog.call_minutes, 0, 59),
				seconds: clamp(dialog.call_seconds, 0, 59)
			};
		} else {
			parts = parseCallDurationParts(dialog.call_duration || dialog.call_duration_text || "00:32");
		}

		vm.$set(dialog, "call_hours", parts.hours);
		vm.$set(dialog, "call_minutes", parts.minutes);
		vm.$set(dialog, "call_seconds", parts.seconds);

		durationText = dialog.call_status === "connected"
			? formatCallDuration(parts.hours, parts.minutes, parts.seconds)
			: "";

		vm.$set(dialog, "call_duration", durationText);
		vm.$set(dialog, "call_duration_text", durationText);
		vm.$set(dialog, "call_status_text", getCallStatusText(dialog.call_status, durationText, dialog.is_me));
		if (typeof dialog.call_show_unread === "undefined") {
			vm.$set(dialog, "call_show_unread", false);
		}
	}

	function patchExistingCallDialogs(vm) {
		vm.dialogs.forEach(function (dialog) {
			if (dialog.type !== "call") return;
			applyCallDialogMetadata(vm, dialog);
		});
	}

	function attachCallExtension(vm) {
		if (!vm) return false;
		if (vm.__callExtensionReady) return true;

		normalizeCallSettings(vm);
		patchExistingCallDialogs(vm);

		var originalSave = vm.save;
		vm.save = function () {
			var phone = $("#phone");
			var phoneBody = phone.find(".phone-body");
			var phoneContent = phoneBody.find(".wechat-content");
			var phoneBottom = phone.find(".phone-bottom");
			var phoneBg = phone.find(".phone-bg");
			var phoneWater = phone.find(".phone-water");
			var originalPhoneStyle = phone.attr("style");
			var originalBodyStyle = phoneBody.attr("style");
			var originalBottomStyle = phoneBottom.attr("style");
			var originalBgStyle = phoneBg.attr("style");
			var originalWaterStyle = phoneWater.attr("style");
			var originalScrollTop = phoneBody.scrollTop();
			var topOffset = parseInt(phoneBody.css("top"), 10) || 264;
			var bottomHeight = phoneBottom.outerHeight() || 269;
			var contentHeight = Math.max(phoneContent.outerHeight(true), phoneBody.get(0).scrollHeight || 0);
			var fullPhoneHeight = Math.max(phone.height(), topOffset + contentHeight + bottomHeight);
			var restored = false;

			function restorePhone() {
				if (restored) return;
				restored = true;
				phone.removeClass("phone-exporting-full");
				if (originalPhoneStyle) phone.attr("style", originalPhoneStyle); else phone.removeAttr("style");
				if (originalBodyStyle) phoneBody.attr("style", originalBodyStyle); else phoneBody.removeAttr("style");
				if (originalBottomStyle) phoneBottom.attr("style", originalBottomStyle); else phoneBottom.removeAttr("style");
				if (originalBgStyle) phoneBg.attr("style", originalBgStyle); else phoneBg.removeAttr("style");
				if (originalWaterStyle) phoneWater.attr("style", originalWaterStyle); else phoneWater.removeAttr("style");
				phoneBody.scrollTop(originalScrollTop);
			}

			phone.addClass("phone-exporting-full");
			phone.css("height", fullPhoneHeight + "px");
			phoneBg.css("height", fullPhoneHeight + "px");
			phoneWater.css("height", fullPhoneHeight + "px");
			phoneBody.css({
				top: topOffset + "px",
				bottom: "auto",
				height: contentHeight + "px",
				overflow: "visible"
			});
			phoneBody.scrollTop(0);
			phoneBottom.css({
				top: topOffset + contentHeight + "px",
				bottom: "auto"
			});

			setTimeout(restorePhone, 2200);
			return originalSave.apply(this, arguments);
		};

		vm.addCallDialog = function (mode) {
			var selectedUser = this.getSelectedUser();
			var callStatus;
			var hours;
			var minutes;
			var seconds;
			var callDuration;
			var dialog;

			if (!selectedUser) return alert("请选择用户"), false;

			callStatus = normalizeCallStatus(this.setting.dialog_call_status);
			hours = clamp(this.setting.dialog_call_hours, 0, 23);
			minutes = clamp(this.setting.dialog_call_minutes, 0, 59);
			seconds = clamp(this.setting.dialog_call_seconds, 0, 59);

			if (callStatus === "connected" && hours === 0 && minutes === 0 && seconds === 0) {
				seconds = 32;
				this.$set(this.setting, "dialog_call_seconds", seconds);
			}

			callDuration = callStatus === "connected"
				? formatCallDuration(hours, minutes, seconds)
				: "";

			dialog = {
				id: "dialog-" + (new Date).valueOf(),
				type: "call",
				call_mode: mode === "video" ? "video" : "voice",
				call_status: callStatus,
				call_hours: hours,
				call_minutes: minutes,
				call_seconds: seconds,
				call_duration: callDuration,
				call_duration_text: callDuration,
				call_status_text: getCallStatusText(callStatus, callDuration, selectedUser.is_me),
				call_show_unread: this.setting.dialog_call_show_unread === "1",
				is_me: selectedUser.is_me,
				user_id: selectedUser.id
			};

			this.addDialog(dialog);

			if (callStatus === "connected") {
				this.$set(this.setting, "dialog_call_duration", callDuration);
			}
		};

		vm.__callExtensionReady = true;
		return true;
	}

	function tryAttachExtension() {
		var root = document.getElementById("vueApp");
		var attempts = 0;
		var timer;

		if (!root) return;

		if (attachCallExtension(root.__vue__)) return;

		timer = setInterval(function () {
			attempts += 1;
			if (attachCallExtension(root.__vue__) || attempts > 100) {
				clearInterval(timer);
			}
		}, 100);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tryAttachExtension);
	} else {
		tryAttachExtension();
	}
})();
