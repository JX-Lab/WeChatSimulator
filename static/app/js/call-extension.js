(function () {
	function padCallUnit(value) {
		return value < 10 ? "0" + value : String(value);
	}

	function normalizeCallDuration(value) {
		var raw = String(value == null ? "" : value).trim();
		var match;
		var minutes;
		var seconds;

		if (!raw) return "";

		if (/^\d+$/.test(raw)) {
			value = Math.max(0, parseInt(raw, 10));
			minutes = Math.floor(value / 60);
			seconds = value % 60;
			return padCallUnit(minutes) + ":" + padCallUnit(seconds);
		}

		match = raw.match(/^(\d{1,2}):(\d{1,2})$/);
		if (!match) return raw;

		minutes = Math.max(0, parseInt(match[1], 10));
		seconds = Math.max(0, Math.min(59, parseInt(match[2], 10)));
		return padCallUnit(minutes) + ":" + padCallUnit(seconds);
	}

	function ensureSetting(vm, key, value) {
		if (typeof vm.setting[key] === "undefined") {
			vm.$set(vm.setting, key, value);
		}
	}

	function patchExistingCallDialogs(vm) {
		vm.dialogs.forEach(function (dialog) {
			if (dialog.type !== "call") return;
			if (!dialog.call_mode) vm.$set(dialog, "call_mode", "voice");
			if (!dialog.call_status) vm.$set(dialog, "call_status", "connected");
			if (!dialog.call_duration && dialog.call_status === "connected") {
				vm.$set(dialog, "call_duration", "00:32");
			}
		});
	}

	function attachCallExtension(vm) {
		if (!vm || vm.__callExtensionReady) return true;

		ensureSetting(vm, "dialog_call_status", "connected");
		ensureSetting(vm, "dialog_call_duration", "00:32");
		patchExistingCallDialogs(vm);

		vm.normalizeCallDuration = normalizeCallDuration;
		vm.addCallDialog = function (mode) {
			var selectedUser = this.getSelectedUser();
			var callStatus;
			var callDuration;
			var dialog;

			if (!selectedUser) return alert("请选择用户"), false;

			callStatus = this.setting.dialog_call_status || "connected";
			callDuration = callStatus === "connected"
				? this.normalizeCallDuration(this.setting.dialog_call_duration || "00:32")
				: "";

			if (callStatus === "connected" && !callDuration) {
				callDuration = "00:32";
			}

			dialog = {
				id: "dialog-" + (new Date).valueOf(),
				type: "call",
				call_mode: mode === "video" ? "video" : "voice",
				call_status: callStatus,
				call_duration: callDuration,
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
