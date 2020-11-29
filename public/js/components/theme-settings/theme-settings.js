import htmlTemplate from "./theme-settings.html";
import stylesheet from "!!css-loader!./theme-settings.css";

export class ThemeSettingsComponent extends HTMLElement
{
	constructor()
	{
		super();
		this.attachShadow({mode: "open"});

		const element = document.createElement("template");
		element.innerHTML = htmlTemplate;

		const styleElement = document.createElement("style");
		styleElement.innerHTML = stylesheet.toString();

		this.shadowRoot.append(styleElement);
		this.shadowRoot.append(element.content.cloneNode(true));

		this.toggleElement = this.shadowRoot.querySelector("#theme-toggle");
		this.toggleElement.addEventListener("change", () => this.dispatchEvent(new Event("change")));
	}

	updateButton(isDarkTheme)
	{
		this.toggleElement.setPressed(isDarkTheme);
	}

	changeTheme(isNewThemeDark)
	{
		if (isNewThemeDark)
		{
			if (document.body.classList.contains("light-theme"))
				document.body.classList.remove("light-theme");

			if (!document.body.classList.contains("dark-theme"))
				document.body.classList.add("dark-theme");

			localStorage.setItem("theme", 1);

		} else if (!isNewThemeDark)
		{
			if (document.body.classList.contains("dark-theme"))
				document.body.classList.remove("dark-theme");

			if (!document.body.classList.contains("light-theme"))
				document.body.classList.add("light-theme");

			localStorage.setItem("theme", 0);
		}
	}
}