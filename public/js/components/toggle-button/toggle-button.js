import htmlTemplate from "./toggle-button.html";
import stylesheet from "!!css-loader!./toggle-button.css";

export class ToggleButtonComponent extends HTMLElement
{
	constructor()
	{
		super();
		this.attachShadow({mode: "open"});

		this.pressed = false;
		if (this.hasAttribute("data-pressed") && this.getAttribute("data-pressed") == true)
		{
			this.pressed = true;
		} else
		{
			this.setAttribute("data-pressed", this.pressed);
		}

		const element = document.createElement("template");
		element.innerHTML = htmlTemplate;

		const styleElement = document.createElement("style");
		styleElement.innerHTML = stylesheet.toString();

		this.shadowRoot.append(styleElement);
		this.shadowRoot.append(element.content.cloneNode(true));

		this.changeEvent = new Event("change");
		this.addEventListener("click", this.clicked);
	}

	clicked(e)
	{
		this.pressed = !this.pressed;
		this.update();
		this.dispatchEvent(this.changeEvent);
	}

	update()
	{
		const outerElement = this.shadowRoot.querySelector(".toggle-outer");
		if (this.pressed)
		{
			if (!outerElement.classList.contains("pressed"))
				outerElement.classList.add("pressed");
		} else
		{
			if (outerElement.classList.contains("pressed"))
				outerElement.classList.remove("pressed");
		}
	}

	setPressed(value)
	{
		if (value == true)
			this.pressed = true;
		else
			this.pressed = false;

		this.update();
	}
}